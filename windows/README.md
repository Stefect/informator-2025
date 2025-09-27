# Windows Screen Capture

A simple screen capture application that streams the screen to a remote server.

## Requirements

- Windows 10/11
- Visual C++ Redistributable (if not already installed)

## Installation

1. Download the latest release
2. Extract the files to a folder of your choice
3. Run `run.bat` to start the application

## Configuration

The application uses a `config.json` file for configuration. If the file doesn't exist, it will be created with default settings:

```json
{
  "server": {
    "host": "localhost",
    "port": 8080
  },
  "capture": {
    "fps": 3,
    "quality": 80,
    "resolution": {
      "width": 1280,
      "height": 720
    }
  }
}
```

### Configuration Options

- `server.host`: The hostname or IP address of the server
- `server.port`: The port number of the server
- `capture.fps`: Frames per second (1-30)
- `capture.quality`: JPEG quality (1-100)
- `capture.resolution.width`: Capture width in pixels
- `capture.resolution.height`: Capture height in pixels

## Usage

1. Edit `config.json` to match your server settings
2. Run `run.bat`
3. The application will start capturing and streaming to the server
4. Press any key to stop the capture

## Building from Source

If you want to build the application from source:

1. Install Node.js and npm
2. Install Visual Studio with C++ development tools
3. Run the following commands:

```bash
npm install
npm run pkg
```

The executable will be created in the `dist` folder.

## Troubleshooting

- If you get a "Missing DLL" error, install the latest Visual C++ Redistributable
- If the capture is slow, try reducing the FPS or resolution
- If the quality is poor, try increasing the JPEG quality
- Make sure the server is running and accessible
