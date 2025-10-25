/**
 * Screen Capture Implementation using DXGI Desktop Duplication API
 * Оптимізовано для мінімального споживання ресурсів
 */

#include "screen-capture.h"
#include <stdexcept>
#include <sstream>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

ScreenCapture::ScreenCapture() {
}

ScreenCapture::~ScreenCapture() {
    Cleanup();
}

void ScreenCapture::SetError(const std::string& error) {
    last_error_ = error;
}

bool ScreenCapture::Initialize(int width, int height) {
    // Очистити попередні ресурси
    Cleanup();

    // Ініціалізувати D3D11
    if (!InitializeD3D()) {
        return false;
    }

    // Ініціалізувати Desktop Duplication
    if (!InitializeDuplication()) {
        Cleanup();
        return false;
    }

    // Встановити розміри
    if (width > 0 && height > 0) {
        width_ = width;
        height_ = height;
    } else {
        width_ = desktop_width_;
        height_ = desktop_height_;
    }

    // Створити staging texture для копіювання з GPU
    if (!CreateStagingTexture()) {
        Cleanup();
        return false;
    }

    return true;
}

bool ScreenCapture::InitializeD3D() {
    HRESULT hr;

    // Створити D3D11 Device та Context
    D3D_FEATURE_LEVEL feature_level;
    D3D_FEATURE_LEVEL feature_levels[] = { D3D_FEATURE_LEVEL_11_0 };

    hr = D3D11CreateDevice(
        nullptr,                    // Adapter (nullptr = default)
        D3D_DRIVER_TYPE_HARDWARE,   // Апаратне прискорення
        nullptr,                    // Software rasterizer
        0,                          // Flags
        feature_levels,
        1,
        D3D11_SDK_VERSION,
        &d3d_device_,
        &feature_level,
        &d3d_context_
    );

    if (FAILED(hr)) {
        SetError("Failed to create D3D11 Device");
        return false;
    }

    return true;
}

bool ScreenCapture::InitializeDuplication() {
    HRESULT hr;

    // Отримати DXGI Device
    IDXGIDevice* dxgi_device = nullptr;
    hr = d3d_device_->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgi_device);
    if (FAILED(hr)) {
        SetError("Failed to get DXGI Device");
        return false;
    }

    // Отримати DXGI Adapter
    IDXGIAdapter* dxgi_adapter = nullptr;
    hr = dxgi_device->GetParent(__uuidof(IDXGIAdapter), (void**)&dxgi_adapter);
    dxgi_device->Release();
    if (FAILED(hr)) {
        SetError("Failed to get DXGI Adapter");
        return false;
    }

    // Отримати Output (монітор)
    IDXGIOutput* dxgi_output = nullptr;
    hr = dxgi_adapter->EnumOutputs(0, &dxgi_output);
    dxgi_adapter->Release();
    if (FAILED(hr)) {
        SetError("Failed to get DXGI Output");
        return false;
    }

    // Отримати розмір екрану
    DXGI_OUTPUT_DESC output_desc;
    dxgi_output->GetDesc(&output_desc);
    desktop_width_ = output_desc.DesktopCoordinates.right - output_desc.DesktopCoordinates.left;
    desktop_height_ = output_desc.DesktopCoordinates.bottom - output_desc.DesktopCoordinates.top;

    // Отримати IDXGIOutput1
    IDXGIOutput1* dxgi_output1 = nullptr;
    hr = dxgi_output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&dxgi_output1);
    dxgi_output->Release();
    if (FAILED(hr)) {
        SetError("Failed to get IDXGIOutput1");
        return false;
    }

    // Створити Desktop Duplication
    hr = dxgi_output1->DuplicateOutput(d3d_device_, &duplication_);
    dxgi_output1->Release();
    if (FAILED(hr)) {
        if (hr == DXGI_ERROR_NOT_CURRENTLY_AVAILABLE) {
            SetError("Desktop Duplication not available (max sessions reached or unsupported)");
        } else {
            SetError("Failed to create Desktop Duplication");
        }
        return false;
    }

    return true;
}

bool ScreenCapture::CreateStagingTexture() {
    // Опис staging texture (для копіювання з GPU на CPU)
    D3D11_TEXTURE2D_DESC desc = {};
    desc.Width = width_;
    desc.Height = height_;
    desc.MipLevels = 1;
    desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.SampleDesc.Quality = 0;
    desc.Usage = D3D11_USAGE_STAGING;
    desc.BindFlags = 0;
    desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    desc.MiscFlags = 0;

    HRESULT hr = d3d_device_->CreateTexture2D(&desc, nullptr, &staging_texture_);
    if (FAILED(hr)) {
        SetError("Failed to create staging texture");
        return false;
    }

    return true;
}

bool ScreenCapture::CaptureFrame(std::vector<uint8_t>& frameData) {
    if (!duplication_ || !staging_texture_) {
        SetError("Not initialized");
        return false;
    }

    HRESULT hr;
    IDXGIResource* desktop_resource = nullptr;
    DXGI_OUTDUPL_FRAME_INFO frame_info;

    // Отримати наступний кадр (timeout 100ms)
    hr = duplication_->AcquireNextFrame(100, &frame_info, &desktop_resource);
    
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
        // Немає нового кадру - це нормально
        return false;
    }
    
    if (FAILED(hr)) {
        if (hr == DXGI_ERROR_ACCESS_LOST) {
            // Desktop Duplication втрачено (зміна режиму екрану, тощо)
            SetError("Access lost - reinitialize required");
            Cleanup();
        } else {
            SetError("Failed to acquire next frame");
        }
        return false;
    }

    // Перевірити чи є оновлення
    if (frame_info.LastPresentTime.QuadPart == 0) {
        desktop_resource->Release();
        duplication_->ReleaseFrame();
        return false;
    }

    // Отримати текстуру
    ID3D11Texture2D* desktop_texture = nullptr;
    hr = desktop_resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&desktop_texture);
    desktop_resource->Release();
    
    if (FAILED(hr)) {
        duplication_->ReleaseFrame();
        SetError("Failed to get desktop texture");
        return false;
    }

    // Скопіювати в staging texture
    if (width_ == desktop_width_ && height_ == desktop_height_) {
        // Копіювати весь екран
        d3d_context_->CopyResource(staging_texture_, desktop_texture);
    } else {
        // Копіювати з масштабуванням (використати Box для обрізки)
        D3D11_BOX source_box;
        source_box.left = 0;
        source_box.right = width_;
        source_box.top = 0;
        source_box.bottom = height_;
        source_box.front = 0;
        source_box.back = 1;
        
        d3d_context_->CopySubresourceRegion(
            staging_texture_, 0, 0, 0, 0,
            desktop_texture, 0, &source_box
        );
    }

    desktop_texture->Release();

    // Прочитати дані з staging texture
    D3D11_MAPPED_SUBRESOURCE mapped_resource;
    hr = d3d_context_->Map(staging_texture_, 0, D3D11_MAP_READ, 0, &mapped_resource);
    
    if (FAILED(hr)) {
        duplication_->ReleaseFrame();
        SetError("Failed to map staging texture");
        return false;
    }

    // Скопіювати дані (BGRA формат)
    size_t frame_size = width_ * height_ * 4; // 4 bytes per pixel (BGRA)
    frameData.resize(frame_size);

    uint8_t* src = static_cast<uint8_t*>(mapped_resource.pData);
    uint8_t* dst = frameData.data();

    // Копіювати рядок за рядком (враховуючи pitch)
    for (int y = 0; y < height_; ++y) {
        memcpy(dst, src, width_ * 4);
        src += mapped_resource.RowPitch;
        dst += width_ * 4;
    }

    // Unmap
    d3d_context_->Unmap(staging_texture_, 0);

    // Звільнити кадр
    duplication_->ReleaseFrame();

    return true;
}

void ScreenCapture::Cleanup() {
    if (staging_texture_) {
        staging_texture_->Release();
        staging_texture_ = nullptr;
    }

    if (duplication_) {
        duplication_->Release();
        duplication_ = nullptr;
    }

    if (d3d_context_) {
        d3d_context_->Release();
        d3d_context_ = nullptr;
    }

    if (d3d_device_) {
        d3d_device_->Release();
        d3d_device_ = nullptr;
    }

    width_ = 0;
    height_ = 0;
    desktop_width_ = 0;
    desktop_height_ = 0;
}
