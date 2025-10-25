/**
 * Native NAPI Module - Entry Point
 * Повна реалізація NAPI біндингів для захоплення екрану та кодування
 */

#include <napi.h>
#include "screen-capture.h"
#include "encoder.h"
#include <memory>
#include <mutex>

// Глобальні об'єкти (один екземпляр на процес)
static std::unique_ptr<ScreenCapture> g_screen_capture;
static std::unique_ptr<H264Encoder> g_encoder;
static std::mutex g_mutex;

// Ініціалізація захоплення екрану
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected object with configuration").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object config = info[0].As<Napi::Object>();
    Napi::Object result = Napi::Object::New(env);

    try {
        std::lock_guard<std::mutex> lock(g_mutex);

        // Отримати параметри
        int width = 0;
        int height = 0;
        int bitrate = 2000000;
        int fps = 30;
        bool useHardware = true;

        if (config.Has("width")) {
            width = config.Get("width").As<Napi::Number>().Int32Value();
        }
        if (config.Has("height")) {
            height = config.Get("height").As<Napi::Number>().Int32Value();
        }
        if (config.Has("bitrate")) {
            bitrate = config.Get("bitrate").As<Napi::Number>().Int32Value();
        }
        if (config.Has("fps")) {
            fps = config.Get("fps").As<Napi::Number>().Int32Value();
        }
        if (config.Has("useHardware")) {
            useHardware = config.Get("useHardware").As<Napi::Boolean>().Value();
        }

        // Створити об'єкти
        g_screen_capture = std::make_unique<ScreenCapture>();
        g_encoder = std::make_unique<H264Encoder>();

        // Ініціалізувати захоплення екрану
        if (!g_screen_capture->Initialize(width, height)) {
            result.Set("success", Napi::Boolean::New(env, false));
            result.Set("error", Napi::String::New(env, g_screen_capture->GetLastError()));
            g_screen_capture.reset();
            g_encoder.reset();
            return result;
        }

        // Ініціалізувати енкодер ТІЛЬКИ ЯКЩО bitrate > 0
        int actual_width = g_screen_capture->GetWidth();
        int actual_height = g_screen_capture->GetHeight();
        
        if (bitrate > 0) {
            if (!g_encoder->Initialize(actual_width, actual_height, bitrate, fps, useHardware)) {
                result.Set("success", Napi::Boolean::New(env, false));
                result.Set("error", Napi::String::New(env, g_encoder->GetLastError()));
                g_screen_capture.reset();
                g_encoder.reset();
                return result;
            }
            result.Set("encoderEnabled", Napi::Boolean::New(env, true));
        } else {
            // Енкодер вимкнений - відправляємо RAW
            g_encoder.reset();
            result.Set("encoderEnabled", Napi::Boolean::New(env, false));
        }

        result.Set("success", Napi::Boolean::New(env, true));
        result.Set("width", Napi::Number::New(env, actual_width));
        result.Set("height", Napi::Number::New(env, actual_height));
        
    } catch (const std::exception& e) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, e.what()));
    }

    return result;
}

// Отримання інформації про екран
Napi::Value GetScreenInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object screenInfo = Napi::Object::New(env);

    try {
        std::lock_guard<std::mutex> lock(g_mutex);

        if (g_screen_capture) {
            screenInfo.Set("width", Napi::Number::New(env, g_screen_capture->GetWidth()));
            screenInfo.Set("height", Napi::Number::New(env, g_screen_capture->GetHeight()));
            screenInfo.Set("initialized", Napi::Boolean::New(env, true));
        } else {
            // Створити тимчасовий об'єкт для отримання інформації
            ScreenCapture temp_capture;
            if (temp_capture.Initialize(0, 0)) {
                screenInfo.Set("width", Napi::Number::New(env, temp_capture.GetWidth()));
                screenInfo.Set("height", Napi::Number::New(env, temp_capture.GetHeight()));
                screenInfo.Set("initialized", Napi::Boolean::New(env, false));
            } else {
                Napi::Error::New(env, "Failed to get screen info").ThrowAsJavaScriptException();
                return env.Null();
            }
        }
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }

    return screenInfo;
}

// Захоплення одного кадру
Napi::Value CaptureFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);

    try {
        std::lock_guard<std::mutex> lock(g_mutex);

        if (!g_screen_capture) {
            result.Set("success", Napi::Boolean::New(env, false));
            result.Set("error", Napi::String::New(env, "Not initialized"));
            return result;
        }

        // Захопити кадр
        std::vector<uint8_t> frameData;
        if (!g_screen_capture->CaptureFrame(frameData)) {
            result.Set("success", Napi::Boolean::New(env, false));
            result.Set("error", Napi::String::New(env, "NO_NEW_FRAME"));
            return result;
        }

        // Якщо енкодер є - закодувати
        if (g_encoder) {
            std::vector<uint8_t> h264Data;
            if (!g_encoder->Encode(frameData, h264Data)) {
                // Може бути нормально (потрібно більше кадрів)
                if (g_encoder->GetLastError().find("need more input") != std::string::npos) {
                    result.Set("success", Napi::Boolean::New(env, true));
                    result.Set("encoded", Napi::Boolean::New(env, false));
                    return result;
                }
                
                result.Set("success", Napi::Boolean::New(env, false));
                result.Set("error", Napi::String::New(env, g_encoder->GetLastError()));
                return result;
            }

            // Повернути H.264 дані
            if (h264Data.size() > 0) {
                Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, h264Data.data(), h264Data.size());
                result.Set("success", Napi::Boolean::New(env, true));
                result.Set("encoded", Napi::Boolean::New(env, true));
                result.Set("data", buffer);
                result.Set("size", Napi::Number::New(env, h264Data.size()));
            } else {
                result.Set("success", Napi::Boolean::New(env, true));
                result.Set("encoded", Napi::Boolean::New(env, false));
            }
        } else {
            // Енкодер вимкнений - повернути RAW BGRA дані
            Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, frameData.data(), frameData.size());
            result.Set("success", Napi::Boolean::New(env, true));
            result.Set("encoded", Napi::Boolean::New(env, false));
            result.Set("data", buffer);
            result.Set("size", Napi::Number::New(env, frameData.size()));
        }

    } catch (const std::exception& e) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, e.what()));
    }

    return result;
}

// Зупинка захоплення
Napi::Value StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);

    try {
        std::lock_guard<std::mutex> lock(g_mutex);
        
        // Очистити ресурси (буде виклик деструкторів)
        g_screen_capture.reset();
        g_encoder.reset();

        result.Set("success", Napi::Boolean::New(env, true));
    } catch (const std::exception& e) {
        result.Set("success", Napi::Boolean::New(env, false));
        result.Set("error", Napi::String::New(env, e.what()));
    }

    return result;
}

// Cleanup ресурсів
Napi::Value Cleanup(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_screen_capture.reset();
        g_encoder.reset();
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    }

    return env.Undefined();
}

// Ініціалізація модуля
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("getScreenInfo", Napi::Function::New(env, GetScreenInfo));
    exports.Set("captureFrame", Napi::Function::New(env, CaptureFrame));
    exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
    exports.Set("cleanup", Napi::Function::New(env, Cleanup));

    return exports;
}

NODE_API_MODULE(screen_capture, Init)
