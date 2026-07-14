# Dimenson-x
# Pixel3D: Client-Side 2D to 3D Parallax Engine

An ultra-premium, high-performance web application that transforms standard flat 2D images into interactive, tactile 3D relief structures completely locally in the browser canvas. 

Built with a captivating Blackpink-inspired visual aesthetic, the project completely bypasses heavy server-side AI pipelines and processing queues by executing lighting shaders and depth-displacement mapping directly on the user's device.

---

## Core Features

*   **100% Local Processing:** Zero server costs, zero API keys, and absolute data privacy. Conversion happens in milliseconds entirely inside the client-side browser.
*   **High-End 3D Viewport:** A dense $256 \times 256$ vertex plane geometry driven by WebGL (Three.js) maps image luminosity directly into physical spatial coordinate depth.
*   **Tactile Touch Interaction:** The 3D canvas responds fluidly to mouse movements and mobile touch drag coordinates, creating an immersive, lag-free parallax depth illusion at 60fps.
*   **Premium Blackpink UI System:** A captivating dark interface featuring deep obsidian gradients (`#09090b`), high-blur glassmorphic panels, fine chrome borders, and vibrant Neon Magenta (`#ff007f`) interactive accents.

---

## Tech Stack

*   **Frontend Architecture:** Modern component-driven architecture optimized for cross-platform layouts.
*   **3D Graphics Engine:** WebGL via Three.js utilizing custom `MeshStandardMaterial` for specular reflection, dynamic shadow casting, and spotlight illumination.
*   **Depth Calculation:** Local HTML5 Canvas extraction engine applying real-time grayscale filtering and alpha-blur algorithms to isolate image lighting as high-resolution displacement maps.
*   **Development Workspace:** Rapidly scaffolded and orchestrated using an AI-first vibe-coding loop inside the Google Antigravity IDE.
[ 2D Photo Upload ]
│
▼
[ Hidden HTML5 Canvas ] ──► (Grayscale & Blur Filters applied)
│
▼
[ Luminosity Depth Map ] ──► (Generates vertex height matrices)
│
▼
[ Three.js Render Node ] ──► (Binds textures to dense 256x256 PlaneGeometry)
│
▼
[ Interactive Viewport ] ──► (Dynamic mouse/touch parallax tilting)

npm install
npm run dev
---

## How It Works Under the Hood
