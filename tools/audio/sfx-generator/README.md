# SFX Generator

![Thumbnail](thumbnail.png)

A powerful Web Audio API-based sound effects generator that allows you to create custom audio samples with various waveforms, parameters, and presets.

## Features

- **Multiple Waveform Types**: Square, Sawtooth, Sine, and Triangle waveforms
- **Preset System**: Predefined sound effects for quick use (Jump, Explosion, Blip, Laser, Powerup, Shoot, Hit, Bounce)
- **Real-time Visualization**: Audio waveform visualization during playback
- **Parameter Controls**: 
  - Frequency (Freq)
  - Duration (Length)
  - Slide (frequency slide effect)
  - ADSR Envelope (Attack, Decay)
- **Save & Load Presets**: Store your custom sound effects for later use
- **Randomize Function**: Generate random sound effects with one click
- **Download WAV Files**: Export your creations as WAV audio files

## How It Works

This tool uses the Web Audio API to generate sound effects in real-time. You can adjust various parameters to create different sounds:

1. **Waveform Selection**: Choose between different waveform types that affect the sound character
2. **Frequency Control**: Adjust the base frequency of the sound
3. **Duration**: Control how long the sound lasts
4. **Slide**: Create pitch slide effects by adjusting the frequency over time
5. **ADSR Envelope**: Control the attack and decay of the sound for more natural sound shaping

## Usage Instructions

1. **Select a Preset**: Click on any preset button (Jump, Explosion, Blip, etc.) to load a predefined sound effect
2. **Adjust Parameters**: Use the sliders to modify the sound characteristics:
   - **Freq**: Base frequency of the sound
   - **Length**: Duration of the sound effect
   - **Slide**: Pitch slide effect (positive values increase pitch, negative values decrease pitch)
   - **Attack/Decay**: Control the envelope of the sound
3. **Waveform Selection**: Choose between Square, Sawtooth, Sine, and Triangle waveforms
4. **Play Sound**: Click the "🔊 PLAY" button to hear your sound effect
5. **Download**: Click the "💾 WAV" button to download your sound effect as a WAV file
6. **Save Preset**: Click "💾 Save Preset" to save your current settings for later use

## Controls

- **Waveform Buttons**: Select different waveform types
- **Lock Buttons**: Lock parameters to prevent accidental changes
- **Randomize Button**: Generate random sound effect parameters
- **Preset Buttons**: Load predefined sound effects
- **Play Button**: Play the current sound effect
- **Download Button**: Save the sound effect as a WAV file
- **Save Preset Button**: Save current settings as a custom preset
- **Load Preset Button**: Load previously saved presets

## Technical Details

This tool uses the Web Audio API for sound generation and the Canvas API for real-time waveform visualization. All processing happens in the browser - no external dependencies or server requests required.

### Supported Parameters

- **Waveform Types**: square, sawtooth, sine, triangle
- **Frequency Range**: 50Hz to 2000Hz
- **Duration Range**: 0.05s to 2.0s
- **Slide Range**: -1000 to 1000 (frequency change over time)
- **Attack Range**: 0 to 0.5 seconds
- **Decay Range**: 0 to 0.5 seconds

## Browser Compatibility

This tool requires a modern browser with Web Audio API support:
- Chrome 14+
- Firefox 25+
- Safari 6+
- Edge 12+

## License

MIT License

Copyright (c) 2026 URageTools

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Author

URageTools - A collection of creative web tools for developers and designers

For more information about this project, visit our GitHub repository.