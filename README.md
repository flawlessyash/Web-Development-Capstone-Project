# Hidden Voice Recorder

A minimal Python-based voice recording application that can run in the background with a clean, hidden interface.

## Features

- 🎤 **Background Recording**: Records audio with minimal system footprint
- 🔇 **Hidden Mode**: Run with minimal output for discrete recording
- 📁 **Auto File Management**: Automatically saves recordings with timestamps
- ⚙️ **Configurable**: Adjustable sample rate, channels, and output directory
- 🛑 **Graceful Shutdown**: Clean exit with Ctrl+C, automatically saves recordings

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

**Note**: On macOS, you may need to install PortAudio first:
```bash
brew install portaudio
```

## Usage

### Basic Recording
```bash
python voice_recorder.py
```

### Hidden Mode (Minimal Output)
```bash
python voice_recorder.py --hidden
```

### Custom Output Directory
```bash
python voice_recorder.py --output /path/to/recordings
```

### List Existing Recordings
```bash
python voice_recorder.py --list
```

### Advanced Options
```bash
python voice_recorder.py --rate 48000 --channels 2 --output my_recordings
```

## Command Line Options

- `--output`, `-o`: Output directory for recordings (default: `recordings`)
- `--list`, `-l`: List existing recordings
- `--rate`, `-r`: Sample rate in Hz (default: 44100)
- `--channels`, `-c`: Number of audio channels (default: 1)
- `--hidden`: Run in hidden mode with minimal output

## Controls

- **Ctrl+C**: Stop recording and save to file
- The application automatically creates timestamped WAV files

## File Format

Recordings are saved as WAV files with the format:
- **Filename**: `recording_YYYYMMDD_HHMMSS.wav`
- **Format**: 16-bit PCM WAV
- **Location**: Specified output directory (default: `recordings/`)

## Privacy & Legal Notice

⚠️ **Important**: This tool is for legitimate recording purposes only. Always ensure you have proper consent before recording conversations, especially in jurisdictions where recording without consent may be illegal.

## Troubleshooting

### PyAudio Installation Issues
If you encounter issues installing PyAudio:

**On macOS:**
```bash
brew install portaudio
pip install pyaudio
```

**On Ubuntu/Debian:**
```bash
sudo apt-get install portaudio19-dev python3-pyaudio
pip install pyaudio
```

**On Windows:**
```bash
pip install pipwin
pipwin install pyaudio
```

### Permission Issues
On macOS, you may need to grant microphone permissions to Terminal or your Python environment in System Preferences > Security & Privacy > Privacy > Microphone.
# Web-Development-Capstone-Project
