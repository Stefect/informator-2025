#include <napi.h>
#include <windows.h>
#include <gdiplus.h>
#include <memory>
#include <vector>

#pragma comment(lib, "gdiplus.lib")

using namespace Napi;

class ScreenCapture : public ObjectWrap<ScreenCapture>
{
public:
    static void Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "ScreenCapture", {InstanceMethod("capture", &ScreenCapture::Capture), InstanceMethod("release", &ScreenCapture::Release)});

        exports.Set("ScreenCapture", func);
    }

    ScreenCapture(const Napi::CallbackInfo &info) : ObjectWrap<ScreenCapture>(info)
    {
        Gdiplus::GdiplusStartupInput gdiplusStartupInput;
        Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);
    }

private:
    ULONG_PTR gdiplusToken;
    std::vector<BYTE> buffer;

    Napi::Value Capture(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        HDC hdcScreen = GetDC(NULL);
        HDC hdcMem = CreateCompatibleDC(hdcScreen);

        int width = GetSystemMetrics(SM_CXSCREEN);
        int height = GetSystemMetrics(SM_CYSCREEN);

        HBITMAP hbmScreen = CreateCompatibleBitmap(hdcScreen, width, height);
        SelectObject(hdcMem, hbmScreen);

        BitBlt(hdcMem, 0, 0, width, height, hdcScreen, 0, 0, SRCCOPY);

        Gdiplus::Bitmap bitmap(hbmScreen, NULL);

        IStream *istream = nullptr;
        CreateStreamOnHGlobal(NULL, TRUE, &istream);

        CLSID jpegClsid;
        CLSIDFromString(L"{557CF401-1A04-11D3-9A73-0000F81EF32E}", &jpegClsid);

        Gdiplus::EncoderParameters encoderParameters;
        encoderParameters.Count = 1;
        encoderParameters.Parameter[0].Guid = Gdiplus::EncoderQuality;
        encoderParameters.Parameter[0].Type = Gdiplus::EncoderParameterValueTypeLong;
        encoderParameters.Parameter[0].NumberOfValues = 1;
        ULONG quality = 80;
        encoderParameters.Parameter[0].Value = &quality;

        bitmap.Save(istream, &jpegClsid, &encoderParameters);

        STATSTG stats;
        istream->Stat(&stats, STATFLAG_NONAME);

        buffer.resize(stats.cbSize.LowPart);
        LARGE_INTEGER li = {0};
        istream->Seek(li, STREAM_SEEK_SET, NULL);
        istream->Read(buffer.data(), stats.cbSize.LowPart, NULL);

        istream->Release();
        DeleteObject(hbmScreen);
        DeleteDC(hdcMem);
        ReleaseDC(NULL, hdcScreen);

        return Napi::Buffer<BYTE>::Copy(env, buffer.data(), buffer.size());
    }

    void Release(const Napi::CallbackInfo &info)
    {
        Gdiplus::GdiplusShutdown(gdiplusToken);
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    ScreenCapture::Init(env, exports);
    return exports;
}

NODE_API_MODULE(screen_capture, Init)