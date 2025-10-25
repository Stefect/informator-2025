/**
 * H.264 Encoder Implementation using Media Foundation
 * Оптимізовано для апаратного кодування (Intel Quick Sync, NVIDIA NVENC, AMD VCE)
 */

#include "encoder.h"
#include <codecapi.h>
#include <wmcodecdsp.h>

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "mfreadwrite.lib")

// Визначення флагів, якщо не визначені в SDK
#ifndef MFT_ENUM_FLAG_SOFTWARE_ONLY
#define MFT_ENUM_FLAG_SOFTWARE_ONLY 0x00000004
#endif

#ifndef MFT_ENUM_FLAG_HARDWARE
#define MFT_ENUM_FLAG_HARDWARE 0x00000040
#endif

H264Encoder::H264Encoder() {
}

H264Encoder::~H264Encoder() {
    Cleanup();
}

void H264Encoder::SetError(const std::string& error) {
    last_error_ = error;
}

bool H264Encoder::Initialize(int width, int height, int bitrate, int fps, bool useHardware) {
    width_ = width;
    height_ = height;
    bitrate_ = bitrate;
    fps_ = fps;
    use_hardware_ = useHardware;

    // Розрахувати тривалість кадру
    sample_duration_ = 10000000LL / fps_; // 100-nanosecond units

    // Ініціалізувати Media Foundation
    if (!InitializeMediaFoundation()) {
        return false;
    }

    // Створити енкодер
    if (!CreateEncoder()) {
        Cleanup();
        return false;
    }

    // Налаштувати енкодер
    if (!ConfigureEncoder()) {
        Cleanup();
        return false;
    }

    return true;
}

bool H264Encoder::InitializeMediaFoundation() {
    if (mf_initialized_) {
        return true;
    }

    HRESULT hr = MFStartup(MF_VERSION, MFSTARTUP_FULL);
    if (FAILED(hr)) {
        SetError("Failed to initialize Media Foundation");
        return false;
    }

    mf_initialized_ = true;
    return true;
}

bool H264Encoder::CreateEncoder() {
    HRESULT hr;

    // Шукати H.264 енкодер
    MFT_REGISTER_TYPE_INFO input_info = { MFMediaType_Video, MFVideoFormat_NV12 };
    MFT_REGISTER_TYPE_INFO output_info = { MFMediaType_Video, MFVideoFormat_H264 };

    IMFActivate** activates = nullptr;
    UINT32 count = 0;

    UINT32 flags = MFT_ENUM_FLAG_HARDWARE;
    if (!use_hardware_) {
        flags = MFT_ENUM_FLAG_SOFTWARE_ONLY;
    }

    hr = MFTEnumEx(
        MFT_CATEGORY_VIDEO_ENCODER,
        flags,
        &input_info,
        &output_info,
        &activates,
        &count
    );

    if (FAILED(hr) || count == 0) {
        if (use_hardware_) {
            // Спробувати програмний енкодер
            SetError("Hardware encoder not found, trying software");
            use_hardware_ = false;
            
            hr = MFTEnumEx(
                MFT_CATEGORY_VIDEO_ENCODER,
                MFT_ENUM_FLAG_SOFTWARE_ONLY,
                &input_info,
                &output_info,
                &activates,
                &count
            );
            
            if (FAILED(hr) || count == 0) {
                SetError("No H.264 encoder found");
                return false;
            }
        } else {
            SetError("No H.264 encoder found");
            return false;
        }
    }

    // Активувати перший енкодер
    hr = activates[0]->ActivateObject(IID_PPV_ARGS(&encoder_));

    // Звільнити активатори
    for (UINT32 i = 0; i < count; i++) {
        activates[i]->Release();
    }
    CoTaskMemFree(activates);

    if (FAILED(hr)) {
        SetError("Failed to activate H.264 encoder");
        return false;
    }

    return true;
}

bool H264Encoder::ConfigureEncoder() {
    HRESULT hr;

    // КРОК 1: Отримати доступні вихідні типи від енкодера
    IMFMediaType* available_output_type = nullptr;
    hr = encoder_->GetOutputAvailableType(0, 0, &available_output_type);
    if (FAILED(hr)) {
        SetError("Failed to get available output type");
        return false;
    }

    // КРОК 2: Налаштувати вихідний тип на основі доступного
    available_output_type->SetUINT32(MF_MT_AVG_BITRATE, bitrate_);
    available_output_type->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    MFSetAttributeSize(available_output_type, MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(available_output_type, MF_MT_FRAME_RATE, fps_, 1);
    
    // Встановити вихідний тип
    hr = encoder_->SetOutputType(0, available_output_type, 0);
    available_output_type->Release();
    
    if (FAILED(hr)) {
        char error_msg[256];
        sprintf_s(error_msg, "Failed to set output type (HRESULT: 0x%08X)", hr);
        SetError(error_msg);
        return false;
    }

    // КРОК 3: Отримати доступні вхідні типи після встановлення вихідного
    IMFMediaType* available_input_type = nullptr;
    hr = encoder_->GetInputAvailableType(0, 0, &available_input_type);
    if (FAILED(hr)) {
        SetError("Failed to get available input type");
        return false;
    }

    // КРОК 4: Налаштувати вхідний тип на основі доступного
    available_input_type->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    MFSetAttributeSize(available_input_type, MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(available_input_type, MF_MT_FRAME_RATE, fps_, 1);
    MFSetAttributeRatio(available_input_type, MF_MT_PIXEL_ASPECT_RATIO, 1, 1);

    // Встановити вхідний тип
    hr = encoder_->SetInputType(0, available_input_type, 0);
    
    // Зберегти input_type_ для подальшого використання
    input_type_ = available_input_type;
    
    if (FAILED(hr)) {
        char error_msg[256];
        sprintf_s(error_msg, "Failed to set input type (HRESULT: 0x%08X)", hr);
        SetError(error_msg);
        input_type_->Release();
        input_type_ = nullptr;
        return false;
    }

    // Налаштувати властивості енкодера
    ICodecAPI* codec_api = nullptr;
    hr = encoder_->QueryInterface(IID_PPV_ARGS(&codec_api));
    if (SUCCEEDED(hr)) {
        // Низька затримка для live streaming
        VARIANT var;
        var.vt = VT_UI4;
        var.ulVal = eAVEncCommonRateControlMode_CBR; // Constant bitrate
        codec_api->SetValue(&CODECAPI_AVEncCommonRateControlMode, &var);

        var.ulVal = 0; // Низька затримка
        codec_api->SetValue(&CODECAPI_AVEncCommonLowLatency, &var);

        codec_api->Release();
    }

    // Почати streaming
    hr = encoder_->ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0);
    if (FAILED(hr)) {
        SetError("Failed to begin streaming");
        return false;
    }

    hr = encoder_->ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0);
    if (FAILED(hr)) {
        SetError("Failed to start stream");
        return false;
    }

    return true;
}

bool H264Encoder::Encode(const std::vector<uint8_t>& bgraData, std::vector<uint8_t>& h264Data) {
    if (!encoder_) {
        SetError("Encoder not initialized");
        return false;
    }

    HRESULT hr;

    // Перевірити розмір даних
    size_t expected_size = width_ * height_ * 4; // BGRA = 4 bytes per pixel
    if (bgraData.size() != expected_size) {
        SetError("Invalid input data size");
        return false;
    }

    // Конвертувати BGRA -> NV12
    std::vector<uint8_t> nv12_data(width_ * height_ * 3 / 2);
    
    // Y plane
    for (int y = 0; y < height_; y++) {
        for (int x = 0; x < width_; x++) {
            int bgra_idx = (y * width_ + x) * 4;
            int y_idx = y * width_ + x;
            
            uint8_t b = bgraData[bgra_idx + 0];
            uint8_t g = bgraData[bgra_idx + 1];
            uint8_t r = bgraData[bgra_idx + 2];
            
            // BT.601 formula
            nv12_data[y_idx] = (uint8_t)((0.257 * r + 0.504 * g + 0.098 * b) + 16);
        }
    }
    
    // UV plane (subsampled 2x2)
    int uv_offset = width_ * height_;
    for (int y = 0; y < height_; y += 2) {
        for (int x = 0; x < width_; x += 2) {
            int bgra_idx = (y * width_ + x) * 4;
            int uv_idx = uv_offset + (y / 2) * width_ + x;
            
            uint8_t b = bgraData[bgra_idx + 0];
            uint8_t g = bgraData[bgra_idx + 1];
            uint8_t r = bgraData[bgra_idx + 2];
            
            nv12_data[uv_idx + 0] = (uint8_t)((-0.148 * r - 0.291 * g + 0.439 * b) + 128); // U
            nv12_data[uv_idx + 1] = (uint8_t)((0.439 * r - 0.368 * g - 0.071 * b) + 128);  // V
        }
    }

    // Створити Media Buffer
    IMFMediaBuffer* media_buffer = nullptr;
    hr = MFCreateMemoryBuffer((DWORD)nv12_data.size(), &media_buffer);
    if (FAILED(hr)) {
        SetError("Failed to create media buffer");
        return false;
    }

    // Скопіювати дані в буфер
    BYTE* buffer_data = nullptr;
    hr = media_buffer->Lock(&buffer_data, nullptr, nullptr);
    if (SUCCEEDED(hr)) {
        memcpy(buffer_data, nv12_data.data(), nv12_data.size());
        media_buffer->Unlock();
        media_buffer->SetCurrentLength((DWORD)nv12_data.size());
    }

    // Створити Sample
    IMFSample* sample = nullptr;
    hr = MFCreateSample(&sample);
    if (FAILED(hr)) {
        media_buffer->Release();
        SetError("Failed to create sample");
        return false;
    }

    sample->AddBuffer(media_buffer);
    sample->SetSampleTime(sample_time_);
    sample->SetSampleDuration(sample_duration_);
    
    sample_time_ += sample_duration_;

    media_buffer->Release();

    // Подати на вхід енкодера
    hr = encoder_->ProcessInput(0, sample, 0);
    sample->Release();
    
    if (FAILED(hr)) {
        SetError("Failed to process input");
        return false;
    }

    // Отримати вихідні дані
    MFT_OUTPUT_DATA_BUFFER output_buffer = {};
    output_buffer.dwStreamID = 0;
    
    hr = MFCreateSample(&output_buffer.pSample);
    if (FAILED(hr)) {
        SetError("Failed to create output sample");
        return false;
    }

    hr = MFCreateMemoryBuffer(width_ * height_, &media_buffer);
    if (SUCCEEDED(hr)) {
        output_buffer.pSample->AddBuffer(media_buffer);
        media_buffer->Release();
    }

    DWORD status = 0;
    hr = encoder_->ProcessOutput(0, 1, &output_buffer, &status);

    if (hr == MF_E_TRANSFORM_NEED_MORE_INPUT) {
        // Потрібно більше даних - це нормально
        output_buffer.pSample->Release();
        return true;
    }

    if (FAILED(hr)) {
        output_buffer.pSample->Release();
        SetError("Failed to process output");
        return false;
    }

    // Отримати дані з output sample
    hr = output_buffer.pSample->ConvertToContiguousBuffer(&media_buffer);
    if (SUCCEEDED(hr)) {
        BYTE* data = nullptr;
        DWORD length = 0;
        
        hr = media_buffer->Lock(&data, nullptr, &length);
        if (SUCCEEDED(hr)) {
            h264Data.assign(data, data + length);
            media_buffer->Unlock();
        }
        
        media_buffer->Release();
    }

    output_buffer.pSample->Release();

    return h264Data.size() > 0;
}

void H264Encoder::Cleanup() {
    if (encoder_) {
        encoder_->ProcessMessage(MFT_MESSAGE_NOTIFY_END_OF_STREAM, 0);
        encoder_->ProcessMessage(MFT_MESSAGE_COMMAND_FLUSH, 0);
        encoder_->Release();
        encoder_ = nullptr;
    }

    if (input_type_) {
        input_type_->Release();
        input_type_ = nullptr;
    }

    if (output_type_) {
        output_type_->Release();
        output_type_ = nullptr;
    }

    if (mf_initialized_) {
        MFShutdown();
        mf_initialized_ = false;
    }

    sample_time_ = 0;
}
