{
  "targets": [{
    "target_name": "gdi_screen_capture",
    "sources": [ "src/gdi_screen_capture.cpp" ],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "defines": [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    "conditions": [
      ["OS=='win'", {
        "libraries": [
          "-lgdiplus.lib",
          "-lole32.lib",
          "-loleaut32.lib",
          "-lgdi32.lib",
          "-luser32.lib"
        ],
        "msvs_settings": {
          "VCCLCompilerTool": {
            "AdditionalIncludeDirectories": [
              "$(WindowsSdkDir)Include\\um",
              "$(WindowsSdkDir)Include\\shared"
            ],
            "AdditionalOptions": [ "-std:c++17" ]
          },
          "VCLinkerTool": {
            "AdditionalLibraryDirectories": [
              "$(WindowsSdkDir)Lib\\um\\x64"
            ]
          }
        }
      }]
    ]
  }]
}