#include <napi.h>
#include <windows.h>
#include <algorithm>
#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef min
#define min(a,b) ((a) < (b) ? (a) : (b))
#endif
#ifndef max
#define max(a,b) ((a) > (b) ? (a) : (b))
#endif
#include <gdiplus.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <vector>
#include <memory>
#include <chrono>

#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "gdiplus.lib")

using namespace Gdiplus;

class ScreenCapture {
private:
    ULONG_PTR gdiplusToken;
    int screenWidth;
    int screenHeight;
    std::chrono::high_resolution_clock::time_point lastCapture;
    
    // DXGI Desktop Duplication members
    ID3D11Device* d3dDevice = nullptr;
    ID3D11DeviceContext* d3dContext = nullptr;
    IDXGIOutputDuplication* deskDupl = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    bool isDXGIInitialized = false;
    
public:
    ScreenCapture() {
        GdiplusStartupInput gdiplusStartupInput;
        GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);
        
        screenWidth = GetSystemMetrics(SM_CXSCREEN);
        screenHeight = GetSystemMetrics(SM_CYSCREEN);
        
        InitializeDXGI();
    }
    
    ~ScreenCapture() {
        CleanupDXGI();
        GdiplusShutdown(gdiplusToken);
    }
    
    bool InitializeDXGI() {
        HRESULT hr;
        
        // Create D3D11 device
        D3D_FEATURE_LEVEL featureLevel;
        hr = D3D11CreateDevice(
            nullptr,
            D3D_DRIVER_TYPE_HARDWARE,
            nullptr,
            0,
            nullptr,
            0,
            D3D11_SDK_VERSION,
            &d3dDevice,
            &featureLevel,
            &d3dContext
        );
        
        if (FAILED(hr)) return false;
        
        // Get DXGI device
        IDXGIDevice* dxgiDevice = nullptr;
        hr = d3dDevice->QueryInterface(__uuidof(IDXGIDevice), reinterpret_cast<void**>(&dxgiDevice));
        if (FAILED(hr)) return false;
        
        // Get DXGI adapter
        IDXGIAdapter* dxgiAdapter = nullptr;
        hr = dxgiDevice->GetAdapter(&dxgiAdapter);
        dxgiDevice->Release();
        if (FAILED(hr)) return false;
        
        // Get output
        IDXGIOutput* dxgiOutput = nullptr;
        hr = dxgiAdapter->EnumOutputs(0, &dxgiOutput);
        dxgiAdapter->Release();
        if (FAILED(hr)) return false;
        
        // Get output1
        IDXGIOutput1* dxgiOutput1 = nullptr;
        hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1), reinterpret_cast<void**>(&dxgiOutput1));
        dxgiOutput->Release();
        if (FAILED(hr)) return false;
        
        // Create desktop duplication
        hr = dxgiOutput1->DuplicateOutput(d3dDevice, &deskDupl);
        dxgiOutput1->Release();
        if (FAILED(hr)) return false;
        
        // Create staging texture
        D3D11_TEXTURE2D_DESC desc = {};
        desc.Width = screenWidth;
        desc.Height = screenHeight;
        desc.MipLevels = 1;
        desc.ArraySize = 1;
        desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        desc.SampleDesc.Count = 1;
        desc.Usage = D3D11_USAGE_STAGING;
        desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        
        hr = d3dDevice->CreateTexture2D(&desc, nullptr, &stagingTexture);
        if (FAILED(hr)) return false;
        
        isDXGIInitialized = true;
        return true;
    }
    
    void CleanupDXGI() {
        if (stagingTexture) {
            stagingTexture->Release();
            stagingTexture = nullptr;
        }
        if (deskDupl) {
            deskDupl->Release();
            deskDupl = nullptr;
        }
        if (d3dContext) {
            d3dContext->Release();
            d3dContext = nullptr;
        }
        if (d3dDevice) {
            d3dDevice->Release();
            d3dDevice = nullptr;
        }
        isDXGIInitialized = false;
    }
    
    std::vector<uint8_t> CaptureScreenDXGI() {
        if (!isDXGIInitialized) {
            return CaptureScreenGDI(); // Fallback to GDI
        }
        
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* desktopResource = nullptr;
        
        // 16ms timeout для 60+ FPS підтримки
        HRESULT hr = deskDupl->AcquireNextFrame(16, &frameInfo, &desktopResource);
        if (FAILED(hr)) {
            if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
                return std::vector<uint8_t>(); // No new frame
            }
            // Try to reinitialize
            CleanupDXGI();
            InitializeDXGI();
            return std::vector<uint8_t>();
        }
        
        // Get texture
        ID3D11Texture2D* acquiredDesktopImage = nullptr;
        hr = desktopResource->QueryInterface(__uuidof(ID3D11Texture2D), reinterpret_cast<void**>(&acquiredDesktopImage));
        desktopResource->Release();
        
        if (FAILED(hr)) {
            deskDupl->ReleaseFrame();
            return std::vector<uint8_t>();
        }
        
        // Copy to staging texture
        d3dContext->CopyResource(stagingTexture, acquiredDesktopImage);
        acquiredDesktopImage->Release();
        
        // Map staging texture
        D3D11_MAPPED_SUBRESOURCE mappedResource;
        hr = d3dContext->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mappedResource);
        
        if (FAILED(hr)) {
            deskDupl->ReleaseFrame();
            return std::vector<uint8_t>();
        }
        
        // Convert to JPEG
        std::vector<uint8_t> jpegData = ConvertToJPEG(
            static_cast<uint8_t*>(mappedResource.pData),
            screenWidth,
            screenHeight,
            mappedResource.RowPitch
        );
        
        d3dContext->Unmap(stagingTexture, 0);
        deskDupl->ReleaseFrame();
        
        return jpegData;
    }
    
    std::vector<uint8_t> CaptureScreenGDI() {
        HDC hScreenDC = GetDC(NULL);
        HDC hMemoryDC = CreateCompatibleDC(hScreenDC);
        
        HBITMAP hBitmap = CreateCompatibleBitmap(hScreenDC, screenWidth, screenHeight);
        HBITMAP hOldBitmap = (HBITMAP)SelectObject(hMemoryDC, hBitmap);
        
        // Capture screen using BitBlt
        BitBlt(hMemoryDC, 0, 0, screenWidth, screenHeight, hScreenDC, 0, 0, SRCCOPY);
        
        // Convert to JPEG using GDI+
        Bitmap bitmap(hBitmap, NULL);
        
        // Get JPEG encoder
        CLSID jpegClsid;
        GetEncoderClsid(L"image/jpeg", &jpegClsid);
        
        // Set quality
        EncoderParameters encoderParams;
        encoderParams.Count = 1;
        encoderParams.Parameter[0].Guid = EncoderQuality;
        encoderParams.Parameter[0].Type = EncoderParameterValueTypeLong;
        encoderParams.Parameter[0].NumberOfValues = 1;
        ULONG quality = 85; // 85% quality for balance between size and quality
        encoderParams.Parameter[0].Value = &quality;
        
        // Save to memory stream
        IStream* stream = nullptr;
        CreateStreamOnHGlobal(NULL, TRUE, &stream);
        
        Status status = bitmap.Save(stream, &jpegClsid, &encoderParams);
        
        std::vector<uint8_t> jpegData;
        if (status == Ok) {
            HGLOBAL hGlobal;
            GetHGlobalFromStream(stream, &hGlobal);
            
            SIZE_T size = GlobalSize(hGlobal);
            void* data = GlobalLock(hGlobal);
            
            if (data && size > 0) {
                jpegData.resize(size);
                memcpy(jpegData.data(), data, size);
            }
            
            GlobalUnlock(hGlobal);
        }
        
        stream->Release();
        
        // Cleanup
        SelectObject(hMemoryDC, hOldBitmap);
        DeleteObject(hBitmap);
        DeleteDC(hMemoryDC);
        ReleaseDC(NULL, hScreenDC);
        
        return jpegData;
    }
    
    std::vector<uint8_t> ConvertToJPEG(uint8_t* data, int width, int height, int rowPitch) {
        // Create bitmap from raw data
        Bitmap bitmap(width, height, rowPitch, PixelFormat32bppARGB, data);
        
        // Get JPEG encoder
        CLSID jpegClsid;
        GetEncoderClsid(L"image/jpeg", &jpegClsid);
        
        // Set quality
        EncoderParameters encoderParams;
        encoderParams.Count = 1;
        encoderParams.Parameter[0].Guid = EncoderQuality;
        encoderParams.Parameter[0].Type = EncoderParameterValueTypeLong;
        encoderParams.Parameter[0].NumberOfValues = 1;
        ULONG quality = 85;
        encoderParams.Parameter[0].Value = &quality;
        
        // Save to memory stream
        IStream* stream = nullptr;
        CreateStreamOnHGlobal(NULL, TRUE, &stream);
        
        Status status = bitmap.Save(stream, &jpegClsid, &encoderParams);
        
        std::vector<uint8_t> jpegData;
        if (status == Ok) {
            HGLOBAL hGlobal;
            GetHGlobalFromStream(stream, &hGlobal);
            
            SIZE_T size = GlobalSize(hGlobal);
            void* data = GlobalLock(hGlobal);
            
            if (data && size > 0) {
                jpegData.resize(size);
                memcpy(jpegData.data(), data, size);
            }
            
            GlobalUnlock(hGlobal);
        }
        
        stream->Release();
        return jpegData;
    }
    
    int GetEncoderClsid(const WCHAR* format, CLSID* pClsid) {
        UINT num = 0;
        UINT size = 0;
        
        ImageCodecInfo* pImageCodecInfo = NULL;
        
        GetImageEncodersSize(&num, &size);
        if (size == 0) return -1;
        
        pImageCodecInfo = (ImageCodecInfo*)(malloc(size));
        if (pImageCodecInfo == NULL) return -1;
        
        GetImageEncoders(num, size, pImageCodecInfo);
        
        for (UINT j = 0; j < num; ++j) {
            if (wcscmp(pImageCodecInfo[j].MimeType, format) == 0) {
                *pClsid = pImageCodecInfo[j].Clsid;
                free(pImageCodecInfo);
                return j;
            }
        }
        
        free(pImageCodecInfo);
        return -1;
    }
    
    std::vector<uint8_t> CaptureScreen() {
        auto now = std::chrono::high_resolution_clock::now();
        
        // Try DXGI first (more efficient), fallback to GDI
        std::vector<uint8_t> result = CaptureScreenDXGI();
        if (result.empty()) {
            result = CaptureScreenGDI();
        }
        
        lastCapture = now;
        return result;
    }
    
    bool HasNewFrame(int targetFPS) {
        auto now = std::chrono::high_resolution_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastCapture);
        
        int frameInterval = 1000 / targetFPS; // ms per frame
        return elapsed.count() >= frameInterval;
    }
    
    void GetScreenInfo(int& width, int& height) {
        width = screenWidth;
        height = screenHeight;
    }
};

// Global instance
static std::unique_ptr<ScreenCapture> g_capture;

// JavaScript callable functions
Napi::Value InitCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        g_capture = std::make_unique<ScreenCapture>();
        return Napi::Boolean::New(env, true);
    } catch (...) {
        return Napi::Boolean::New(env, false);
    }
}

Napi::Value CaptureScreen(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_capture) {
        Napi::TypeError::New(env, "Capture not initialized. Call initCapture() first.").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    auto jpegData = g_capture->CaptureScreen();
    
    if (jpegData.empty()) {
        return env.Null();
    }
    
    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, jpegData.data(), jpegData.size());
    return buffer;
}

Napi::Value GetScreenInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_capture) {
        Napi::TypeError::New(env, "Capture not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int width, height;
    g_capture->GetScreenInfo(width, height);
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("width", width);
    result.Set("height", height);
    
    return result;
}

Napi::Value HasNewFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_capture) {
        return Napi::Boolean::New(env, false);
    }
    
    int targetFPS = 30; // Default
    if (info.Length() > 0 && info[0].IsNumber()) {
        targetFPS = info[0].As<Napi::Number>().Int32Value();
    }
    
    return Napi::Boolean::New(env, g_capture->HasNewFrame(targetFPS));
}

Napi::Value CleanupCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    g_capture.reset();
    return Napi::Boolean::New(env, true);
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initCapture", Napi::Function::New(env, InitCapture));
    exports.Set("captureScreen", Napi::Function::New(env, CaptureScreen));
    exports.Set("getScreenInfo", Napi::Function::New(env, GetScreenInfo));
    exports.Set("hasNewFrame", Napi::Function::New(env, HasNewFrame));
    exports.Set("cleanupCapture", Napi::Function::New(env, CleanupCapture));
    
    return exports;
}

NODE_API_MODULE(screen_capture, Init)