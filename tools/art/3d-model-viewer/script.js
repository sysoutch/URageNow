// script.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

let scene, camera, renderer, controls, currentModel, grid;
let currentDashboardAsset = null;
let flatShading = false;
let metallic = 0.5;
let roughness = 0.5;
let displayMode = 'solid';
let lightRotation = 0;
let lightIntensity = 1.2;
let modelRotation = 0;

applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
window.addEventListener('message', handleDashboardMessage);
init();

function applyDashboardTheme(theme) {
    if (typeof window.applyDashboardThemeVars === 'function') {
        window.applyDashboardThemeVars(theme || document.body.getAttribute('data-dashboard-theme') || 'fire');
        return;
    }
    document.body.setAttribute('data-dashboard-theme', String(theme || 'fire').trim() || 'fire');
}

function init() {
    // Scene setup
    scene = new THREE.Scene();
    const container = document.getElementById('viewport');

    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        preserveDrawingBuffer: true 
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(4, 3, 4);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, lightIntensity);
    sun.position.set(5, 10, 7);
    scene.add(sun);

    grid = new THREE.GridHelper(20, 40, 0x2a2a2e, 0x1a1a1a);
    scene.add(grid);

    setupInterface();
    animate();
}

function setupInterface() {
    const input = document.getElementById('file-input');
    const drop = document.getElementById('drop-zone');
    const hdrDrop = document.getElementById('hdr-drop-zone');
    
    // Handle HDR drop zone
    if (hdrDrop) {
        hdrDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            hdrDrop.classList.add('drag-over');
        });

        hdrDrop.addEventListener('dragleave', () => {
            hdrDrop.classList.remove('drag-over');
        });

        hdrDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            hdrDrop.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                loadHDR(files[0]);
            }
        });
    }

    drop.onclick = () => input.click();
    input.onchange = (e) => loadModel(e.target.files[0]);

    // Handle HDR drop zone
    hdrDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        hdrDrop.classList.add('drag-over');
    });

    hdrDrop.addEventListener('dragleave', () => {
        hdrDrop.classList.remove('drag-over');
    });

    hdrDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        hdrDrop.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            loadHDR(files[0]);
        }
    });

    document.getElementById('exposure').oninput = (e) => {
        renderer.toneMappingExposure = e.target.value;
    };

    document.getElementById('reset-cam').onclick = () => {
        camera.position.set(4, 3, 4);
        controls.target.set(0, 0, 0);
        controls.reset();
    };

    document.getElementById('toggle-grid').onclick = () => {
        grid.visible = !grid.visible;
    };

    document.getElementById('download-img').onclick = () => {
        const link = document.createElement('a');
        link.download = 'urage-render.png';
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
    };

    // Model Controls
    document.getElementById('zoom-in').onclick = () => {
        camera.position.multiplyScalar(0.9);
    };
    
    document.getElementById('zoom-out').onclick = () => {
        camera.position.multiplyScalar(1.1);
    };
    
    document.getElementById('rotate').onclick = () => {
        modelRotation += 0.1;
        if (currentModel) {
            currentModel.rotation.y = modelRotation;
        }
    };

    // Light Controls
    document.getElementById('light-rotate').onclick = () => {
        lightRotation += 0.1;
        const sun = scene.children.find(child => child.isDirectionalLight);
        if (sun) {
            sun.position.x = Math.sin(lightRotation) * 10;
            sun.position.z = Math.cos(lightRotation) * 10;
        }
    };
    
    document.getElementById('light-intensity').onclick = () => {
        lightIntensity += 0.1;
        if (lightIntensity > 2) lightIntensity = 0.2;
        const sun = scene.children.find(child => child.isDirectionalLight);
        if (sun) {
            sun.intensity = lightIntensity;
        }
    };

    // Material Properties
    document.getElementById('flat-shading').onclick = () => {
        flatShading = !flatShading;
        updateMaterial();
    };
    
    document.getElementById('metallic').onclick = () => {
        metallic += 0.2;
        if (metallic > 1) metallic = 0;
        updateMaterial();
    };
    
    document.getElementById('roughness').onclick = () => {
        roughness += 0.2;
        if (roughness > 1) roughness = 0;
        updateMaterial();
    };

    // Display Modes
    document.getElementById('solid-mode').onclick = () => {
        displayMode = 'solid';
        updateDisplayMode();
    };
    
    document.getElementById('material-mode').onclick = () => {
        displayMode = 'material';
        updateDisplayMode();
    };
    
    document.getElementById('wireframe-mode').onclick = () => {
        displayMode = 'wireframe';
        updateDisplayMode();
    };

    // Position Controls
    document.getElementById('position-x').onclick = () => {
        if (currentModel) currentModel.position.x += 0.5;
    };
    
    document.getElementById('position-y').onclick = () => {
        if (currentModel) currentModel.position.y += 0.5;
    };
    
    document.getElementById('position-z').onclick = () => {
        if (currentModel) currentModel.position.z += 0.5;
    };

    // Rotation Controls
    document.getElementById('rotate-x').onclick = () => {
        if (currentModel) currentModel.rotation.x += 0.1;
    };
    
    document.getElementById('rotate-y').onclick = () => {
        if (currentModel) currentModel.rotation.y += 0.1;
    };
    
    document.getElementById('rotate-z').onclick = () => {
        if (currentModel) currentModel.rotation.z += 0.1;
    };

    // Slider Controls
    document.getElementById('light-intensity-slider').oninput = (e) => {
        lightIntensity = parseFloat(e.target.value);
        document.getElementById('light-intensity-value').textContent = lightIntensity.toFixed(2);
        const sun = scene.children.find(child => child.isDirectionalLight);
        if (sun) {
            sun.intensity = lightIntensity;
        }
    };

    document.getElementById('flat-shading-slider').oninput = (e) => {
        flatShading = e.target.value === '1';
        document.getElementById('flat-shading-value').textContent = flatShading ? 'On' : 'Off';
        updateMaterial();
    };

    document.getElementById('metallic-slider').oninput = (e) => {
        metallic = parseFloat(e.target.value);
        document.getElementById('metallic-value').textContent = metallic.toFixed(2);
        updateMaterial();
    };

    document.getElementById('roughness-slider').oninput = (e) => {
        roughness = parseFloat(e.target.value);
        document.getElementById('roughness-value').textContent = roughness.toFixed(2);
        updateMaterial();
    };

    window.onresize = () => {
        const container = document.getElementById('viewport');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };

    renderLocalIcons();
}

function renderLocalIcons() {
    const glyphs = {
        box: "□", "upload-cloud": "↑", image: "▧", maximize: "↗", layers: "▤",
        camera: "◉", "zoom-in": "+", "zoom-out": "−", "rotate-cw": "↻",
        "rotate-ccw": "↺", sun: "☼", square: "■", zap: "ϟ", sliders: "≡",
        grid: "▦", move: "↔", "move-vertical": "↕", "move-horizontal": "↔"
    };
    document.querySelectorAll("[data-lucide]").forEach(icon => {
        icon.textContent = glyphs[icon.dataset.lucide] || "•";
        icon.setAttribute("aria-hidden", "true");
    });
}

function loadModelFromUrl(modelUrl, fileNameHint) {
    const sourceUrl = String(modelUrl || '').trim();
    if (!sourceUrl) return;
    const fallbackName = String(fileNameHint || '').trim() || 'dashboard-model.glb';
    document.getElementById('loading').style.display = 'flex';
    fetch(sourceUrl, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch model (' + response.status + ').');
            return response.blob();
        })
        .then(blob => {
            const fileName = String(fallbackName || '').trim() || 'dashboard-model.glb';
            const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
            loadModel(file);
        })
        .catch(error => {
            console.error(error);
            alert('Error loading 3D model from dashboard payload.');
            document.getElementById('loading').style.display = 'none';
        });
}

function setCurrentDashboardAsset(payload) {
    const sourcePayload = payload && typeof payload === 'object' ? payload : {};
    const modelUrl = String(sourcePayload.modelUrl || sourcePayload.url || '').trim();
    if (!modelUrl) {
        currentDashboardAsset = null;
        window.__urageThreeModelViewerCurrentAsset = null;
        return;
    }
    currentDashboardAsset = {
        kind: 'model3d',
        modelUrl,
        modelFileName: String(sourcePayload.modelFileName || sourcePayload.fileName || 'dashboard-model.glb').trim() || 'dashboard-model.glb',
        previewImageUrl: String(sourcePayload.previewImageUrl || '').trim(),
        previewFileName: String(sourcePayload.previewFileName || '').trim(),
        prompt: String(sourcePayload.prompt || '').trim(),
        metadata: sourcePayload.metadata && typeof sourcePayload.metadata === 'object' ? sourcePayload.metadata : {}
    };
    window.__urageThreeModelViewerCurrentAsset = { ...currentDashboardAsset };
}

function handleDashboardMessage(event) {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== 'urage-dashboard') return;
    if (message.type === 'tool:theme') {
        applyDashboardTheme(message.payload?.theme);
        return;
    }
    if (message.type !== 'tool:load-asset') return;
    const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
    if (String(payload.kind || '').trim() !== 'model3d') return;
    const modelUrl = String(payload.modelUrl || payload.url || '').trim();
    if (!modelUrl) return;
    setCurrentDashboardAsset(payload);
    loadModelFromUrl(modelUrl, payload.modelFileName || payload.fileName || 'dashboard-model.glb');
}

window.__threeModelViewerLoadAssetPayload = payload => {
    const modelUrl = String(payload?.modelUrl || payload?.url || '').trim();
    if (!modelUrl) return;
    setCurrentDashboardAsset(payload);
    loadModelFromUrl(modelUrl, payload?.modelFileName || payload?.fileName || 'dashboard-model.glb');
};
window.__urageToolDescribeCurrentAsset = () => currentDashboardAsset ? { ...currentDashboardAsset } : null;

function updateMaterial() {
    if (!currentModel) return;
    
    currentModel.traverse((child) => {
        if (child.isMesh) {
            const material = child.material;
            if (material) {
                material.flatShading = flatShading;
                material.metalness = metallic;
                material.roughness = roughness;
            }
        }
    });
}

function updateDisplayMode() {
    if (!currentModel) return;
    
    currentModel.traverse((child) => {
        if (child.isMesh) {
            switch(displayMode) {
                case 'solid':
                    child.material.wireframe = false;
                    child.material.transparent = false;
                    break;
                case 'material':
                    child.material.wireframe = false;
                    child.material.transparent = true;
                    break;
                case 'wireframe':
                    child.material.wireframe = true;
                    child.material.transparent = true;
                    break;
            }
        }
    });
}

function loadModel(file) {
    if (!file) return;
    document.getElementById('loading').style.display = 'flex';

    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();

    if (currentModel) scene.remove(currentModel);

    const loader = (ext === 'glb' || ext === 'gltf') ? new GLTFLoader() : new OBJLoader();

    loader.load(url, (result) => {
        currentModel = result.scene || result;

        // Auto-frame model
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;

        currentModel.scale.setScalar(scale);
        currentModel.position.sub(center.multiplyScalar(scale));
        currentModel.position.y = 0; // Snap to floor

        scene.add(currentModel);

        // Adjust camera to look at the new model
        controls.reset();

        document.getElementById('loading').style.display = 'none';
        URL.revokeObjectURL(url);
    }, undefined, (err) => {
        console.error(err);
        alert("Error loading 3D model.");
        document.getElementById('loading').style.display = 'none';
    });
}

function loadHDR(file) {
    if (!file) return;
    if (file.name.split('.').pop().toLowerCase() !== 'hdr') {
        alert("Please select an HDR file (.hdr)");
        return;
    }
    
    document.getElementById('loading').style.display = 'flex';
    
    const url = URL.createObjectURL(file);
    
    // Load HDR environment map
    const loader = new RGBELoader();
    loader.load(url, (texture) => {
        // Set the environment map
        scene.environment = texture;
        scene.background = texture;
        
        document.getElementById('loading').style.display = 'none';
        URL.revokeObjectURL(url);
    }, undefined, (err) => {
        console.error(err);
        alert("Error loading HDR environment map.");
        document.getElementById('loading').style.display = 'none';
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Rotate light
    const sun = scene.children.find(child => child.isDirectionalLight);
    if (sun) {
        sun.position.x = Math.sin(lightRotation) * 10;
        sun.position.z = Math.cos(lightRotation) * 10;
    }
    
    renderer.render(scene, camera);
}
