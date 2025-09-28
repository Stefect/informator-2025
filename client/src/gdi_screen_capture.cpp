#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <napi.h>
#include <gdiplus.h>
#include <dwmapi.h>
#include <memory>
#include <vector>
#include <mutex>
#include <chrono>
#include <algorithm>
#include <cmath>

#undef min
#undef max

#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "dwmapi.lib")

using namespace Napi;

// Глобальні змінні для оптимізації
static std::mutex captureMutex;
static std::chrono::steady_clock::time_point lastCaptureTime;
static std::vector<uint8_t> lastCapturedFrameData;
static int lastWidth = 0;
static int lastHeight = 0;
static int targetFPS = 5;
static int jpegQuality = 75;
static float resolutionScale = 0.5f;
static bool hasActiveClients = true;
static bool captureCursor = false;  // За замовчуванням НЕ захоплюємо курсор

// Структура для зберігання розмірів екрану
struct ScreenSize {
    int width;
    int height;
};

// Функція для отримання розмірів екрану
ScreenSize getScreenSize() {
    int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    return { width, height };
}

// Функція кодування в JPEG за допомогою GDI+
std::vector<uint8_t> encodeToJpeg(HBITMAP hBitmap, int quality) {
    std::vector<uint8_t> result;
    
    Gdiplus::Bitmap bitmap(hBitmap, NULL);
    
    // Налаштування кодувальника JPEG
    CLSID jpegClsid;
    CLSIDFromString(L"{557CF401-1A04-11D3-9A73-0000F81EF32E}", &jpegClsid);
    
    Gdiplus::EncoderParameters encoderParams;
    encoderParams.Count = 1;
    encoderParams.Parameter[0].Guid = Gdiplus::EncoderQuality;
    encoderParams.Parameter[0].Type = Gdiplus::EncoderParameterValueTypeLong;
    encoderParams.Parameter[0].NumberOfValues = 1;
    ULONG qualityValue = quality;
    encoderParams.Parameter[0].Value = &qualityValue;
    
    // Створення потоку в пам'яті
    IStream* stream = nullptr;
    if (SUCCEEDED(CreateStreamOnHGlobal(NULL, TRUE, &stream))) {
        if (bitmap.Save(stream, &jpegClsid, &encoderParams) == Gdiplus::Ok) {
            // Отримання розміру даних
            STATSTG stats;
            if (SUCCEEDED(stream->Stat(&stats, STATFLAG_NONAME))) {
                result.resize(stats.cbSize.LowPart);
                
                // Читання даних
                LARGE_INTEGER li = {0};
                stream->Seek(li, STREAM_SEEK_SET, NULL);
                DWORD bytesRead = 0;
                stream->Read(result.data(), stats.cbSize.LowPart, &bytesRead);
            }
        }
        stream->Release();
    }
    
    return result;
}

// Оптимізоване захоплення екрану
std::vector<uint8_t> captureScreen() {
    std::lock_guard<std::mutex> lock(captureMutex);

    // Обмеження частоти кадрів
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastCaptureTime).count();
    int minInterval = 1000 / targetFPS;
    
    if (elapsed < minInterval) {
        return lastCapturedFrameData;
    }

    lastCaptureTime = now;

    if (!hasActiveClients) {
        lastCapturedFrameData.clear();
        return lastCapturedFrameData;
    }

    // Отримання розмірів екрану
    ScreenSize screenSize = getScreenSize();
    int screenWidth = screenSize.width;
    int screenHeight = screenSize.height;
    
    // Перевірка зміни розмірів
    bool sizeChanged = (lastWidth != screenWidth || lastHeight != screenHeight);
    if (sizeChanged) {
        lastWidth = screenWidth;
        lastHeight = screenHeight;
        lastCapturedFrameData.clear();
    }

    // Адаптивне масштабування
    float adaptiveScale = resolutionScale;
    if (screenWidth * screenHeight > 3840 * 2160 && resolutionScale > 0.9f) {
        adaptiveScale = 0.75f;
    }
    
    int captureWidth = static_cast<int>(screenWidth * adaptiveScale);
    int captureHeight = static_cast<int>(screenHeight * adaptiveScale);

    // Створення контекстів пристроїв
    HDC hdcScreen = GetDC(NULL);
    if (!hdcScreen) {
        return lastCapturedFrameData;
    }
    
    HDC hdcMemory = CreateCompatibleDC(hdcScreen);
    if (!hdcMemory) {
        ReleaseDC(NULL, hdcScreen);
        return lastCapturedFrameData;
    }

    HBITMAP hBitmap = CreateCompatibleBitmap(hdcScreen, captureWidth, captureHeight);
    if (!hBitmap) {
        DeleteDC(hdcMemory);
        ReleaseDC(NULL, hdcScreen);
        return lastCapturedFrameData;
    }
    
    HGDIOBJ hOldBitmap = SelectObject(hdcMemory, hBitmap);

    // Захоплення екрану БЕЗ курсора для усунення мелькання
    bool result = false;
    BOOL dwmEnabled = FALSE;
    
    // Спочатку пробуємо DWM захоплення без курсора
    if (SUCCEEDED(DwmIsCompositionEnabled(&dwmEnabled)) && dwmEnabled) {
        result = PrintWindow(GetDesktopWindow(), hdcMemory, PW_RENDERFULLCONTENT);
    }
    
    if (!result) {
        SetStretchBltMode(hdcMemory, HALFTONE);
        SetBrushOrgEx(hdcMemory, 0, 0, NULL);
        // Використовуємо налаштування захоплення курсора
        DWORD rop = SRCCOPY;
        if (captureCursor) {
            rop |= CAPTUREBLT;  // Додаємо захоплення курсора тільки якщо потрібно
        }
        result = StretchBlt(
            hdcMemory, 0, 0, captureWidth, captureHeight,
            hdcScreen, 0, 0, screenWidth, screenHeight,
            rop
        );
    }

    ReleaseDC(NULL, hdcScreen);

    // Кодування в JPEG
    std::vector<uint8_t> jpegData;
    if (result) {
        int adaptiveQuality = jpegQuality;
        if (captureWidth * captureHeight > 1280 * 720) {
            adaptiveQuality = std::max(65, jpegQuality - 10);
        }
        
        jpegData = encodeToJpeg(hBitmap, adaptiveQuality);
        if (!jpegData.empty()) {
            lastCapturedFrameData = jpegData;
        }
    }

    // Очищення ресурсів
    SelectObject(hdcMemory, hOldBitmap);
    DeleteObject(hBitmap);
    DeleteDC(hdcMemory);

    return jpegData.empty() ? lastCapturedFrameData : jpegData;
}

// N-API функції
Napi::Value CaptureScreenMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::vector<uint8_t> imageData = captureScreen();
    if (imageData.empty()) {
        return env.Null();
    }
    
    return Napi::Buffer<uint8_t>::Copy(env, imageData.data(), imageData.size());
}

Napi::Value GetScreenSizeMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    ScreenSize size = getScreenSize();
    Napi::Object result = Napi::Object::New(env);
    result.Set("width", Napi::Number::New(env, size.width));
    result.Set("height", Napi::Number::New(env, size.height));
    
    return result;
}

Napi::Value SetQualityMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsNumber()) {
        jpegQuality = info[0].As<Napi::Number>().Int32Value();
        jpegQuality = std::max(1, std::min(100, jpegQuality));
    }
    
    return env.Undefined();
}

Napi::Value SetResolutionScaleMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsNumber()) {
        resolutionScale = info[0].As<Napi::Number>().FloatValue();
        resolutionScale = std::max(0.1f, std::min(2.0f, resolutionScale));
    }
    
    return env.Undefined();
}

Napi::Value SetTargetFPSMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsNumber()) {
        targetFPS = info[0].As<Napi::Number>().Int32Value();
        targetFPS = std::max(1, std::min(30, targetFPS));
    }
    
    return env.Undefined();
}

Napi::Value SetActiveClientsMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsBoolean()) {
        hasActiveClients = info[0].As<Napi::Boolean>().Value();
    }
    
    return env.Undefined();
}

Napi::Value SetCaptureCursorMethod(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() > 0 && info[0].IsBoolean()) {
        captureCursor = info[0].As<Napi::Boolean>().Value();
    }
    
    return env.Undefined();
}

// Ініціалізація модуля
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Ініціалізація GDI+
    static ULONG_PTR gdiplusToken;
    Gdiplus::GdiplusStartupInput gdiplusStartupInput;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);
    
    // Експорт функцій
    exports.Set("capture", Napi::Function::New(env, CaptureScreenMethod));
    exports.Set("getScreenSize", Napi::Function::New(env, GetScreenSizeMethod));
    exports.Set("setQuality", Napi::Function::New(env, SetQualityMethod));
    exports.Set("setResolutionScale", Napi::Function::New(env, SetResolutionScaleMethod));
    exports.Set("setTargetFPS", Napi::Function::New(env, SetTargetFPSMethod));
    exports.Set("setActiveClients", Napi::Function::New(env, SetActiveClientsMethod));
    exports.Set("setCaptureCursor", Napi::Function::New(env, SetCaptureCursorMethod));
    
    return exports;
}

NODE_API_MODULE(screencapture, Init)