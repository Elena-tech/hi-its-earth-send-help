"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  earthVertexShader, earthFragmentShader,
  atmosphereVertexShader, atmosphereFragmentShader,
  starsVertexShader, starsFragmentShader,
} from "@/lib/shaders";

export interface ClimateState {
  temperature: number;
  co2: number;
  iceMelt: number;
  deforestation: number;
  seaLevel: number;
}

interface Props { climate: ClimateState }

export default function EarthScene({ climate }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ uniforms: Record<string, THREE.IUniform>; animId: number; renderer: THREE.WebGLRenderer } | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5.2);

    // ── Stars ─────────────────────────────────────────────────────────────────
    const N = 10000;
    const pos = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const brightness = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 350 + Math.random() * 150;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
      sizes[i]      = 0.5 + Math.random() * 1.5;
      brightness[i] = 0.5 + Math.random() * 0.5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position",    new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("aSize",       new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    scene.add(new THREE.Points(starGeo, new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      transparent: true,
      depthWrite: false,
    })));

    // ── Textures ──────────────────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    const setTex = (path: string, srgb = false) => {
      const t = loader.load(path);
      t.wrapS          = THREE.RepeatWrapping;
      t.wrapT          = THREE.ClampToEdgeWrapping;
      // NASA textures are non-power-of-2 — disable mipmaps to prevent banding
      t.minFilter      = THREE.LinearFilter;
      t.magFilter      = THREE.LinearFilter;
      t.generateMipmaps = false;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const dayTex    = setTex("/textures/earth_day.jpg",    true);
    const nightTex  = setTex("/textures/earth_night.jpg",  true);
    const cloudsTex = setTex("/textures/earth_clouds.jpg", false);

    // ── Earth uniforms ────────────────────────────────────────────────────────
    const uniforms: Record<string, THREE.IUniform> = {
      uDayTexture:    { value: dayTex },
      uCloudsTexture: { value: cloudsTex },
      uTime:          { value: 0 },
      uTemperature:   { value: climate.temperature },
      uCO2:           { value: climate.co2 },
      uIceMelt:       { value: climate.iceMelt },
      uDeforestation: { value: climate.deforestation },
      uSeaLevel:      { value: climate.seaLevel },
    };

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 128),
      new THREE.ShaderMaterial({ vertexShader: earthVertexShader, fragmentShader: earthFragmentShader, uniforms })
    );
    scene.add(earth);

    // ── Atmosphere ────────────────────────────────────────────────────────────
    const atmoUniforms = { uCO2: uniforms.uCO2, uTemperature: uniforms.uTemperature };
    const atmoMat = (side: THREE.Side, r: number) => new THREE.ShaderMaterial({
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: atmoUniforms,
      transparent: true, side, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 64), atmoMat(THREE.FrontSide, 1.06)));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 64, 64), atmoMat(THREE.BackSide, 1.18)));

    // ── Drag to rotate ────────────────────────────────────────────────────────
    let drag = false;
    let prev = { x: 0, y: 0 };
    let vel  = { x: 0, y: 0 };
    const onDown  = (e: MouseEvent) => { drag = true;  prev = { x: e.clientX, y: e.clientY }; };
    const onUp    = ()               => { drag = false; };
    const onMove  = (e: MouseEvent) => {
      if (!drag) return;
      vel.y = (e.clientX - prev.x) * 0.005;
      vel.x = (e.clientY - prev.y) * 0.005;
      prev  = { x: e.clientX, y: e.clientY };
    };
    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("mousemove", onMove);

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // ── Animate ───────────────────────────────────────────────────────────────
    let animId = 0;
    const tick = (t: number) => {
      animId = requestAnimationFrame(tick);
      uniforms.uTime.value = t * 0.001;
      earth.rotation.y += 0.0006 + vel.y;
      earth.rotation.x  = Math.max(-0.8, Math.min(0.8, earth.rotation.x + vel.x));
      vel.x *= 0.93; vel.y *= 0.93;
      renderer.render(scene, camera);
    };
    requestAnimationFrame(tick);
    sceneRef.current = { uniforms, animId, renderer };

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize",    onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update uniforms without remounting
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.uniforms.uTemperature.value   = climate.temperature;
    s.uniforms.uCO2.value           = climate.co2;
    s.uniforms.uIceMelt.value       = climate.iceMelt;
    s.uniforms.uDeforestation.value = climate.deforestation;
    s.uniforms.uSeaLevel.value      = climate.seaLevel;
  }, [climate]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
