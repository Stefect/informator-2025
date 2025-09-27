#include <napi.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <vector>

class ScreenCapture : public Napi::ObjectWrap<ScreenCapture> {
private:
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* duplication = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    UINT width = 0;
    UINT height = 0;
    bool initialized = false;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "ScreenCapture", {
            InstanceMethod("capture", &ScreenCapture::Capture),
            InstanceMethod("getScreenSize", &ScreenCapture::GetScreenSize)
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("ScreenCapture", func);
        return exports;
    }

    ScreenCapture(const Napi::CallbackInfo& info) : Napi::ObjectWrap<ScreenCapture>(info) {
        Napi::Env env = info.Env();

        // Create D3D11 device
        D3D_FEATURE_LEVEL featureLevel;
        HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);

        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to create D3D11 device").ThrowAsJavaScriptException();
            return;
        }

        // Get DXGI device
        IDXGIDevice* dxgiDevice = nullptr;
        hr = device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to get DXGI device").ThrowAsJavaScriptException();
            return;
        }

        // Get DXGI adapter
        IDXGIAdapter* dxgiAdapter = nullptr;
        hr = dxgiDevice->GetAdapter(&dxgiAdapter);
        dxgiDevice->Release();
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to get DXGI adapter").ThrowAsJavaScriptException();
            return;
        }

        // Get output
        IDXGIOutput* dxgiOutput = nullptr;
        hr = dxgiAdapter->EnumOutputs(0, &dxgiOutput);
        dxgiAdapter->Release();
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to get DXGI output").ThrowAsJavaScriptException();
            return;
        }

        // Get output1
        IDXGIOutput1* dxgiOutput1 = nullptr;
        hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1), (void**)&dxgiOutput1);
        dxgiOutput->Release();
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to get DXGI output1").ThrowAsJavaScriptException();
            return;
        }

        // Get duplication
        hr = dxgiOutput1->DuplicateOutput(device, &duplication);
        dxgiOutput1->Release();
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to get output duplication").ThrowAsJavaScriptException();
            return;
        }

        DXGI_OUTDUPL_DESC desc;
        duplication->GetDesc(&desc);
        width = desc.ModeDesc.Width;
        height = desc.ModeDesc.Height;

        // Create staging texture
        D3D11_TEXTURE2D_DESC textureDesc = {};
        textureDesc.Width = width;
        textureDesc.Height = height;
        textureDesc.MipLevels = 1;
        textureDesc.ArraySize = 1;
        textureDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        textureDesc.SampleDesc.Count = 1;
        textureDesc.Usage = D3D11_USAGE_STAGING;
        textureDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

        hr = device->CreateTexture2D(&textureDesc, nullptr, &stagingTexture);
        if (FAILED(hr)) {
            Napi::Error::New(env, "Failed to create staging texture").ThrowAsJavaScriptException();
            return;
        }

        initialized = true;
    }

    ~ScreenCapture() {
        if (stagingTexture) stagingTexture->Release();
        if (duplication) duplication->Release();
        if (context) context->Release();
        if (device) device->Release();
    }

    Napi::Value GetScreenSize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (!initialized) {
            Napi::Error::New(env, "Screen capture not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }

        Napi::Object result = Napi::Object::New(env);
        result.Set("width", Napi::Number::New(env, width));
        result.Set("height", Napi::Number::New(env, height));
        return result;
    }

    Napi::Value Capture(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (!initialized) {
            Napi::Error::New(env, "Screen capture not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }

        IDXGIResource* desktopResource = nullptr;
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        
        HRESULT hr = duplication->AcquireNextFrame(0, &frameInfo, &desktopResource);
        if (FAILED(hr)) {
            return env.Null();
        }

        ID3D11Texture2D* desktopTexture = nullptr;
        hr = desktopResource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&desktopTexture);
        desktopResource->Release();
        
        if (SUCCEEDED(hr)) {
            context->CopyResource(stagingTexture, desktopTexture);
            desktopTexture->Release();

            D3D11_MAPPED_SUBRESOURCE mappedResource;
            hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mappedResource);
            
            if (SUCCEEDED(hr)) {
                std::vector<uint8_t> buffer(width * height * 4);
                uint8_t* src = static_cast<uint8_t*>(mappedResource.pData);
                
                for (UINT row = 0; row < height; row++) {
                    memcpy(
                        buffer.data() + row * width * 4,
                        src + row * mappedResource.RowPitch,
                        width * 4
                    );
                }
                
                context->Unmap(stagingTexture, 0);
                duplication->ReleaseFrame();

                return Napi::Buffer<uint8_t>::Copy(env, buffer.data(), buffer.size());
            }
            
            duplication->ReleaseFrame();
        }

        return env.Null();
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return ScreenCapture::Init(env, exports);
}

NODE_API_MODULE(screencapture, Init) 