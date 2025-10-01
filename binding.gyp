{
  "targets": [
    {
      "target_name": "screen_capture",
      "sources": [
        "screen_capture.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<(module_root_dir)/node_modules/node-addon-api/node_api.gyp:nothing"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lgdi32",
            "-luser32",
            "-ld3d11",
            "-ldxgi"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}