/**
 * Screen Capture using DXGI (Direct3D 11)
 * Захоплення екрану з мінімальними ресурсами
 */

#ifndef SCREEN_CAPTURE_H
#define SCREEN_CAPTURE_H

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <vector>
#include <string>

class ScreenCapture {
public:
    ScreenCapture();
    ~ScreenCapture();

    bool Initialize(int width = 0, int height = 0);
    bool CaptureFrame(std::vector<uint8_t>& frameData);
    void Cleanup();

    int GetWidth() const { return width_; }
    int GetHeight() const { return height_; }
    std::string GetLastError() const { return last_error_; }

private:
    bool InitializeD3D();
    bool InitializeDuplication();
    bool CreateStagingTexture();
    void SetError(const std::string& error);

    ID3D11Device* d3d_device_ = nullptr;
    ID3D11DeviceContext* d3d_context_ = nullptr;
    IDXGIOutputDuplication* duplication_ = nullptr;
    ID3D11Texture2D* staging_texture_ = nullptr;
    
    int width_ = 0;
    int height_ = 0;
    int desktop_width_ = 0;
    int desktop_height_ = 0;
    std::string last_error_;
};

#endif // SCREEN_CAPTURE_H
