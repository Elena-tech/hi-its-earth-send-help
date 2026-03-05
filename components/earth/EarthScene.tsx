"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  earthVertexShader, earthFragmentShader,
  atmosphereVertexShader, atmosphereFragmentShader,
  starsVertexShader, starsFragmentShader,
} from "@/lib/shaders";

export interface ClimateState {
  temperature: number;   // 0–1
  co2: number;           // 0–1
  iceMelt: number;       // 0–1
  deforestation: number; // 0–1
  seaLevel: number;      // 0–1
}

interface Props {
  climate: ClimateState;
}

export default function EarthScene({ climate }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    earth: THREE.Mesh;
    uniforms: Record<string, THREE.IUniform>;
    animId: number;
  } | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // ── Scene / Camera ────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 3.2);

    // ── Stars ─────────────────────────────────────────────────────────────────
    const starCount = 8000;
    const starPositions  = new Float32Array(starCount * 3);
    const starSizes      = new Float32Array(starCount);
    const starBrightness = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 400 + Math.random() * 100;
      starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      starSizes[i]      = 0.4 + Math.random() * 1.2;
      starBrightness[i] = 0.4 + Math.random() * 0.6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position",    new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("aSize",       new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute("aBrightness", new THREE.BufferAttribute(starBrightness, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Earth ─────────────────────────────────────────────────────────────────
    const uniforms: Record<string, THREE.IUniform> = {
      uTime:          { value: 0 },
      uTemperature:   { value: climate.temperature },
      uCO2:           { value: climate.co2 },
      uIceMelt:       { value: climate.iceMelt },
      uDeforestation: { value: climate.deforestation },
      uSeaLevel:      { value: climate.seaLevel },
    };

    const earthGeo = new THREE.SphereGeometry(1, 128, 128);
    const earthMat = new THREE.ShaderMaterial({
      vertexShader:   earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // ── Atmosphere ────────────────────────────────────────────────────────────
    const atmoGeo = new THREE.SphereGeometry(1.06, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader:   atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: { uCO2: uniforms.uCO2 },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Inner atmosphere (back face glow)
    const atmoInnerMat = new THREE.ShaderMaterial({
      vertexShader:   atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      uniforms: { uCO2: uniforms.uCO2 },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 64, 64), atmoInnerMat));

    // ── Drag to rotate ────────────────────────────────────────────────────────
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotVel = { x: 0, y: 0 };

    const onDown  = (e: MouseEvent) => { isDragging = true;  prevMouse = { x: e.clientX, y: e.clientY }; };
    const onUp    = ()               => { isDragging = false; };
    const onMove  = (e: MouseEvent) => {
      if (!isDragging) return;
      rotVel.x = (e.clientY - prevMouse.y) * 0.005;
      rotVel.y = (e.clientX - prevMouse.x) * 0.005;
      prevMouse = { x: e.clientX, y: e.clientY };
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

      // Auto-rotate + drag inertia
      earth.rotation.y += 0.0008 + rotVel.y;
      earth.rotation.x += rotVel.x;
      earth.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, earth.rotation.x));
      rotVel.x *= 0.92;
      rotVel.y *= 0.92;

      renderer.render(scene, camera);
    };
    requestAnimationFrame(tick);

    sceneRef.current = { renderer, earth, uniforms, animId };

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize",    onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update uniforms when climate changes (no re-mount)
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
