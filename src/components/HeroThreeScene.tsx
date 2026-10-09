"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { heroSceneAccents } from "@/constants/heroScene";

function addChipLayer(
  parent: THREE.Group,
  width: number,
  height: number,
  depth: number,
  y: number,
  color: number,
  roughness: number,
  metalness: number,
) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const layer = new THREE.Mesh(geometry, material);
  layer.position.y = y;
  layer.castShadow = true;
  layer.receiveShadow = true;
  parent.add(layer);
  return layer;
}

function addTrace(parent: THREE.Group, points: THREE.Vector3[], material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const trace = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 36, 0.012, 5, false),
    material,
  );
  parent.add(trace);
  return trace;
}

export default function HeroThreeScene({ slide }: { slide: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef(slide);
  const accentMaterials = useRef<Array<
    THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial
  >>([]);
  const [rendererFailed, setRendererFailed] = useState(false);

  useEffect(() => {
    slideRef.current = slide;
  }, [slide]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionPreference.matches;
    const updateMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    motionPreference.addEventListener("change", updateMotionPreference);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.error("Unable to initialize the Three.js hero scene:", error);
      queueMicrotask(() => setRendererFailed(true));
      motionPreference.removeEventListener("change", updateMotionPreference);
      return;
    }

    const scene = new THREE.Scene();
    accentMaterials.current = [];
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(3.75, 3, 5.7);
    camera.lookAt(0, 0.08, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xc6d4ff, 0x10101c, 1.85);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xe6edff, 4.2);
    keyLight.position.set(-3, 6, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x6366f1, 42, 12);
    rimLight.position.set(3, 2.2, -2);
    scene.add(rimLight);

    const chip = new THREE.Group();
    chip.rotation.set(-0.1, -0.28, 0);
    scene.add(chip);

    addChipLayer(chip, 2.9, 0.1, 2.9, -0.18, 0x101522, 0.3, 0.72);
    addChipLayer(chip, 2.66, 0.035, 2.66, -0.115, 0x555b80, 0.22, 0.9);
    addChipLayer(chip, 2.55, 0.22, 2.55, 0, 0x151622, 0.24, 0.88);
    addChipLayer(chip, 2.3, 0.09, 2.3, 0.15, 0x303449, 0.28, 0.8);
    addChipLayer(chip, 1.92, 0.1, 1.92, 0.24, 0x111522, 0.2, 0.66);

    const contactMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a86a,
      metalness: 0.94,
      roughness: 0.2,
    });
    for (const x of [-1.24, 1.24]) {
      for (const z of [-1.24, 1.24]) {
        const contact = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 16), contactMaterial);
        contact.position.set(x, -0.115, z);
        chip.add(contact);
      }
    }

    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x171b2b,
      emissive: new THREE.Color(heroSceneAccents[slideRef.current % heroSceneAccents.length]),
      emissiveIntensity: 0.2,
      metalness: 0.72,
      roughness: 0.24,
    });
    accentMaterials.current.push(boardMaterial);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 1.55), boardMaterial);
    board.position.y = 0.34;
    board.castShadow = true;
    chip.add(board);

    const coreFrameMaterial = new THREE.MeshStandardMaterial({
      color: heroSceneAccents[slideRef.current % heroSceneAccents.length],
      metalness: 0.72,
      roughness: 0.25,
      emissive: new THREE.Color(heroSceneAccents[slideRef.current % heroSceneAccents.length]),
      emissiveIntensity: 0.3,
    });
    accentMaterials.current.push(coreFrameMaterial);
    const coreFrame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.065, 0.98), coreFrameMaterial);
    coreFrame.position.y = 0.445;
    chip.add(coreFrame);

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x171a2b,
      emissive: new THREE.Color(heroSceneAccents[slideRef.current % heroSceneAccents.length]),
      emissiveIntensity: 0.58,
      metalness: 0.56,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    accentMaterials.current.push(coreMaterial);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.2, 0.82), coreMaterial);
    core.position.y = 0.56;
    core.castShadow = true;
    chip.add(core);

    const coreInsetMaterial = new THREE.MeshBasicMaterial({
      color: 0xe8eaff,
    });
    accentMaterials.current.push(coreInsetMaterial);
    const coreInset = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.025, 0.58), coreInsetMaterial);
    coreInset.position.y = 0.675;
    chip.add(coreInset);

    const pinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4b879,
      metalness: 0.88,
      roughness: 0.24,
    });
    for (let index = 0; index < 9; index += 1) {
      const position = -0.88 + index * 0.22;
      for (const side of [-1, 1]) {
        const pinX = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.24), pinMaterial);
        pinX.position.set(position, 0.16, side * 1.28);
        chip.add(pinX);

        const pinZ = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.1), pinMaterial);
        pinZ.position.set(side * 1.28, 0.16, position);
        chip.add(pinZ);
      }
    }

    const traceMaterial = new THREE.MeshStandardMaterial({
      color: heroSceneAccents[slideRef.current % heroSceneAccents.length],
      emissive: new THREE.Color(heroSceneAccents[slideRef.current % heroSceneAccents.length]),
      emissiveIntensity: 1.25,
      metalness: 0.4,
      roughness: 0.3,
    });
    accentMaterials.current.push(traceMaterial);
    const traceRoutes = [
      [[0.4, 0.415, -0.35], [0.75, 0.415, -0.35], [0.75, 0.415, -1.95]],
      [[-0.4, 0.415, -0.35], [-0.76, 0.415, -0.35], [-0.76, 0.415, -1.8]],
      [[0.4, 0.415, 0.35], [0.8, 0.415, 0.35], [0.8, 0.415, 1.85]],
      [[-0.4, 0.415, 0.35], [-0.88, 0.415, 0.35], [-0.88, 0.415, 1.8]],
      [[-0.3, 0.415, -0.4], [-0.3, 0.415, -0.85], [-1.9, 0.415, -0.85]],
      [[0.3, 0.415, 0.4], [0.3, 0.415, 0.86], [1.9, 0.415, 0.86]],
    ];
    for (const route of traceRoutes) {
      addTrace(
        chip,
        route.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        traceMaterial,
      );
    }

    const orbitMaterial = new THREE.MeshBasicMaterial({
      color: heroSceneAccents[slideRef.current % heroSceneAccents.length],
      transparent: true,
      opacity: 0.62,
    });
    accentMaterials.current.push(orbitMaterial);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.008, 5, 160), orbitMaterial);
    orbit.rotation.set(Math.PI / 2.7, 0.1, -0.28);
    orbit.position.y = 0.1;
    scene.add(orbit);

    const orbitSecondary = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.005, 4, 160),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.28,
      }),
    );
    orbitSecondary.rotation.set(Math.PI / 2.35, -0.2, 0.42);
    orbitSecondary.position.y = 0.08;
    scene.add(orbitSecondary);

    const satellite = new THREE.Group();
    satellite.position.set(2.02, 0, 0);
    const satelliteMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x262944,
      emissive: new THREE.Color(heroSceneAccents[slideRef.current % heroSceneAccents.length]),
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
      clearcoat: 1,
    });
    accentMaterials.current.push(satelliteMaterial);
    const satelliteCore = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), satelliteMaterial);
    satellite.add(satelliteCore);
    orbit.add(satellite);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 80),
      new THREE.MeshBasicMaterial({
        color: 0x080a13,
        transparent: true,
        opacity: 0.44,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    scene.add(floor);

    const particleCount = 85;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 8;
      particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 4;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0xc7d2fe,
        size: 0.018,
        transparent: true,
        opacity: 0.66,
        sizeAttenuation: true,
      }),
    );
    scene.add(particles);

    let frame = 0;
    let animationTime = 0;
    let previousTime = 0;

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(host);

    const animate = (time: number) => {
      frame = window.requestAnimationFrame(animate);
      if (document.hidden) return;

      const delta = Math.min((time - previousTime) / 1000 || 0, 0.05);
      previousTime = time;
      if (!reduceMotion) animationTime += delta;

      chip.rotation.y = -0.28 + (reduceMotion ? 0 : Math.sin(animationTime * 0.35) * 0.08);
      chip.position.y = reduceMotion ? 0 : Math.sin(animationTime * 0.8) * 0.08;
      orbit.rotation.z = reduceMotion ? orbit.rotation.z : animationTime * 0.09;
      orbitSecondary.rotation.z = reduceMotion ? orbitSecondary.rotation.z : -animationTime * 0.06;
      satelliteCore.rotation.set(animationTime * 0.4, animationTime * 0.7, animationTime * 0.3);
      particles.rotation.y = reduceMotion ? 0 : animationTime * 0.012;

      renderer.render(scene, camera);
    };

    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      motionPreference.removeEventListener("change", updateMotionPreference);

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const accent = new THREE.Color(heroSceneAccents[slide % heroSceneAccents.length]);
    accentMaterials.current.forEach((material) => {
      material.color.set(accent);
      if ("emissive" in material) material.emissive.set(accent);
    });
  }, [slide]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="3D holographic processor with illuminated circuit traces"
      className="absolute inset-0"
    >
      {rendererFailed && (
        <div className="absolute inset-0 flex items-center justify-center" role="status">
          <div className="hero-fallback-chip" aria-hidden="true" />
          <span className="sr-only">3D preview is unavailable in this browser.</span>
        </div>
      )}
    </div>
  );
}
