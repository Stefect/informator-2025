/**
 * H.264 Encoder using Media Foundation (Windows)
 * Підтримка апаратного та програмного кодування
 */

#ifndef ENCODER_H
#define ENCODER_H

#include <vector>
#include <cstdint>
#include <string>
#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>

class H264Encoder {
public:
    H264Encoder();
    ~H264Encoder();

    bool Initialize(int width, int height, int bitrate = 2000000, int fps = 30, bool useHardware = true);
    bool Encode(const std::vector<uint8_t>& bgraData, std::vector<uint8_t>& h264Data);
    void Cleanup();
    
    std::string GetLastError() const { return last_error_; }

private:
    bool InitializeMediaFoundation();
    bool CreateEncoder();
    bool ConfigureEncoder();
    void SetError(const std::string& error);
    
    IMFTransform* encoder_ = nullptr;
    IMFMediaType* input_type_ = nullptr;
    IMFMediaType* output_type_ = nullptr;
    IMFSample* input_sample_ = nullptr;
    
    int width_ = 0;
    int height_ = 0;
    int bitrate_ = 0;
    int fps_ = 0;
    bool use_hardware_ = false;
    bool mf_initialized_ = false;
    
    std::string last_error_;
    UINT64 sample_time_ = 0;
    UINT64 sample_duration_ = 0;
};

#endif // ENCODER_H
