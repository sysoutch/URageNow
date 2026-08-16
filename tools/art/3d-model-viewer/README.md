# 3D Model Viewer

![Thumbnail](thumbnail.png)

A feature-rich 3D model viewer built with Three.js that supports GLB, GLTF, and OBJ formats with comprehensive controls.

## Features

- **Model Import**: Drag and drop or click to import 3D models (GLB, GLTF, OBJ)
- **Camera Controls**: Orbit controls with damping for smooth navigation
- **Environment Lighting**: HDRI environment lighting with adjustable exposure
- **Material Controls**: 
  - Flat shading toggle
  - Metallic property adjustment
  - Roughness property adjustment
- **Display Modes**: Solid, material, and wireframe rendering modes
- **Light Controls**: 
  - Light rotation
  - Light intensity adjustment
- **Model Positioning**: 
  - Position controls (X, Y, Z axes)
  - Rotation controls (X, Y, Z axes)
- **Camera Settings**: 
  - Field of view adjustment
  - Near/far clipping plane controls
- **Render Quality**: 
  - Antialiasing toggle
  - Resolution scaling

## Controls

### Scene Toolbar
- **Center View**: Reset camera position and target
- **Toggle Floor**: Show/hide grid floor
- **Capture Render**: Download current view as PNG

### Model Controls
- **Zoom In/Out**: Adjust camera distance
- **Rotate Model**: Rotate model around Y-axis

### Light Controls
- **Rotate Light**: Rotate directional light around the scene
- **Adjust Intensity**: Change light intensity

### Material Properties
- **Flat Shading**: Toggle flat shading
- **Metallic**: Adjust metallic property
- **Roughness**: Adjust roughness property

### Display Modes
- **Solid**: Solid rendering
- **Material**: Transparent material rendering
- **Wireframe**: Wireframe rendering

### Model Positioning
- **Move X/Y/Z**: Adjust model position along axes

### Camera Settings
- **Field of View**: Adjust camera FOV
- **Near Clip**: Adjust near clipping plane
- **Far Clip**: Adjust far clipping plane

## Technical Details

- Built with Three.js R165
- Uses OrbitControls for camera navigation
- Supports HDR environment lighting
- Responsive design with flexible layout
- Modern CSS with gradient effects and smooth animations

## Usage

1. Open `index.html` in a modern web browser
2. Drag and drop a 3D model file (GLB, GLTF, or OBJ) onto the upload area
3. Use the sidebar controls to manipulate the model and scene
4. Adjust lighting, materials, and display settings as needed

## Requirements

- Modern web browser with WebGL support
- Internet connection (for loading Three.js and dependencies from CDN)

## License

This project is part of the URage Tools suite.