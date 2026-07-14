/* ═══════════════════════════════════════════════════════
   Mesh AI — Client-Side Depth Engine (Blackpink)
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM Elements ──
  const stepDots = document.querySelectorAll('.step-dot');

  // States
  const stateUpload = document.getElementById('stateUpload');
  const stateProcessing = document.getElementById('stateProcessing');
  const stateViewport = document.getElementById('stateViewport');

  // Upload UI
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const btnUpload = document.getElementById('btnUpload');
  const sampleCards = document.querySelectorAll('.sample-card');

  // Processing UI
  const processingImage = document.getElementById('processingImage');

  // Viewport UI
  const canvas = document.getElementById('threeCanvas');
  const toggleRenderBtns = document.querySelectorAll('#toggleRender .toggle-btn');
  const depthSlider = document.getElementById('depthSlider');
  const btnDownload = document.getElementById('btnDownload');
  const btnNewConversion = document.getElementById('btnNewConversion');

  // App State
  let currentImageSrc = null;
  let currentDepthMapSrc = null;

  // ── Three.js Global Variables ──
  let renderer, scene, camera, mesh;
  let textureLoader;
  let currentDisplacementScale = 0.5;
  let isWireframe = false;
  let targetRotation = { x: 0, y: 0 };
  let currentRotation = { x: 0, y: 0 };
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // ═══════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════

  function goToState(stateName) {
    stateUpload.classList.remove('active');
    stateProcessing.classList.remove('active');
    stateViewport.classList.remove('active');

    stepDots.forEach(dot => dot.classList.remove('active'));

    switch (stateName) {
      case 'upload':
        stateUpload.classList.add('active');
        stepDots[0].classList.add('active');
        break;
      case 'processing':
        stateProcessing.classList.add('active');
        stepDots[1].classList.add('active');
        // Instantly generate depth map since it's local
        setTimeout(processLocalDepthMap, 500); 
        break;
      case 'viewport':
        stateViewport.classList.add('active');
        stepDots[2].classList.add('active');
        initThreeJS();
        break;
    }
  }

  // ═══════════════════════════════════════════════════
  // FILE HANDLING & UPLOAD
  // ═══════════════════════════════════════════════════

  function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageSrc = e.target.result;
      processingImage.src = currentImageSrc;
      goToState('processing');
    };
    reader.readAsDataURL(file);
  }

  // Drag & Drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
  });

  // Clicks
  dropzone.addEventListener('click', () => fileInput.click());
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileSelect(e.target.files[0]);
  });

  // Samples
  sampleCards.forEach(card => {
    card.addEventListener('click', () => {
      const src = card.getAttribute('data-sample');
      // Convert sample to base64 via fetch so we don't hit canvas CORS issues later
      fetch(src)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e) => {
            currentImageSrc = e.target.result;
            processingImage.src = currentImageSrc;
            goToState('processing');
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error('Failed to load sample', err);
          alert('Failed to load sample image.');
        });
    });
  });

  // ═══════════════════════════════════════════════════
  // LOCAL DEPTH ENGINE (CANVAS PROCESSING)
  // ═══════════════════════════════════════════════════

  function processLocalDepthMap() {
    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      cvs.width = img.width;
      cvs.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Apply grayscale and blur via filter for a pseudo depth-map
      ctx.filter = 'grayscale(100%) blur(4px) contrast(150%)';
      ctx.drawImage(img, 0, 0);

      // Extract as data URL
      currentDepthMapSrc = cvs.toDataURL('image/jpeg', 0.8);

      // Wait a short time for the laser animation to play out visually
      setTimeout(() => goToState('viewport'), 2000);
    };
    img.src = currentImageSrc;
  }

  // ═══════════════════════════════════════════════════
  // THREE.JS VIEWPORT & INTERACTION
  // ═══════════════════════════════════════════════════

  function initThreeJS() {
    // Prevent double init
    if (renderer) return buildScene();

    const container = document.getElementById('viewportContainer');

    scene = new THREE.Scene();
    scene.background = null; // transparent to show CSS gradient

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 12;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    textureLoader = new THREE.TextureLoader();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 10);
    scene.add(dirLight);

    // Neon Magenta Spotlight
    const spotLight = new THREE.SpotLight(0xff007f, 2.5);
    spotLight.position.set(-5, 5, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    // Resize handler
    window.addEventListener('resize', () => {
      if (stateViewport.classList.contains('active')) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      }
    });

    // Setup Custom Mouse Interaction
    setupInteraction(container);

    // Render loop
    renderer.setAnimationLoop(() => {
      if (!mesh) return;

      // Smooth interpolation for rotation
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.1;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.1;

      mesh.rotation.x = currentRotation.y;
      mesh.rotation.y = currentRotation.x;

      renderer.render(scene, camera);
    });

    buildScene();
  }

  function buildScene() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    // Reset rotation
    targetRotation = { x: 0, y: 0 };
    currentRotation = { x: 0, y: 0 };

    textureLoader.load(currentImageSrc, (colorMap) => {
      textureLoader.load(currentDepthMapSrc, (depthMap) => {
        // High density plane (256x256)
        const geometry = new THREE.PlaneGeometry(8, 8, 256, 256);
        
        const material = new THREE.MeshStandardMaterial({
          map: colorMap,
          displacementMap: depthMap,
          displacementScale: currentDisplacementScale,
          displacementBias: -currentDisplacementScale / 2, // keep centered
          wireframe: isWireframe,
          roughness: 0.4,
          metalness: 0.1,
          side: THREE.DoubleSide
        });

        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
      });
    });
  }

  // Tactile Interaction
  function setupInteraction(container) {
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });

    container.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.offsetX - previousMousePosition.x;
        const deltaY = e.offsetY - previousMousePosition.y;
        
        targetRotation.x += deltaX * 0.01;
        targetRotation.y += deltaY * 0.01;
        
        previousMousePosition = { x: e.offsetX, y: e.offsetY };
      } else {
        // Subtle hover movement mapped to plane rotation
        const rect = container.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
        const ny = -(e.clientY - rect.top) / rect.height * 2 + 1;
        targetRotation.x = nx * 0.3;
        targetRotation.y = -ny * 0.3;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      // Reset rotation gently if not dragging
      targetRotation = { x: 0, y: 0 };
    });

    // Touch support
    container.addEventListener('touchstart', (e) => {
      // Prevent local scrolling when touching canvas
      e.preventDefault(); 
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        
        targetRotation.x += deltaX * 0.01;
        targetRotation.y += deltaY * 0.01;
        
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      isDragging = false;
      targetRotation = { x: 0, y: 0 };
    });
  }

  // ═══════════════════════════════════════════════════
  // UI CONTROLS
  // ═══════════════════════════════════════════════════

  // Render Mode Toggle
  toggleRenderBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      toggleRenderBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      isWireframe = e.target.getAttribute('data-value') === 'wireframe';
      if (mesh && mesh.material) {
        mesh.material.wireframe = isWireframe;
      }
    });
  });

  // Depth Scale Slider
  depthSlider.addEventListener('input', (e) => {
    currentDisplacementScale = parseFloat(e.target.value);
    if (mesh && mesh.material) {
      mesh.material.displacementScale = currentDisplacementScale;
      mesh.material.displacementBias = -currentDisplacementScale / 2;
    }
  });

  // Download Output
  btnDownload.addEventListener('click', () => {
    if (!currentDepthMapSrc) return;
    const a = document.createElement('a');
    a.href = currentDepthMapSrc;
    a.download = `depth_map_${Date.now()}.jpg`;
    a.click();
  });

  // New Conversion
  btnNewConversion.addEventListener('click', () => {
    currentImageSrc = null;
    currentDepthMapSrc = null;
    fileInput.value = '';
    goToState('upload');
  });

  // Init
  goToState('upload');
});
