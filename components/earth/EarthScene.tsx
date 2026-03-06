"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import {
  earthVertexShader, earthFragmentShader,
  atmosphereVertexShader, atmosphereFragmentShader,
  starsVertexShader, starsFragmentShader,
} from "@/lib/shaders";
import { spherePointToLatLon } from "@/lib/geo/raycaster";
import { findCountryAt, preloadCountries } from "@/lib/geo/countries";
import { onHeatmapUpdate, loadGlobalHeatmap, type AnomalyMap } from "@/lib/api/globalHeatmap";
import { renderHeatmapToCanvas } from "@/lib/geo/countryCanvas";

export interface ClimateState {
  temperature: number;
  co2: number;
  iceMelt: number;
  deforestation: number;
  seaLevel: number;
  tempAnomaly: number; // actual °C
}

export interface CountryHit {
  name: string;
  lat: number;
  lon: number;
}

interface Props {
  climate: ClimateState;
  year: number;
  isMobile?: boolean;
  onCountryClick?: (country: CountryHit) => void;
}

export default function EarthScene({ climate, year, isMobile, onCountryClick }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ uniforms: Record<string, THREE.IUniform>; animId: number; renderer: THREE.WebGLRenderer } | null>(null);
  const threeRef = useRef<{ camera: THREE.PerspectiveCamera; earth: THREE.Mesh } | null>(null);
  const callbackRef = useRef(onCountryClick);
  callbackRef.current = onCountryClick;

  // Preload country geometry
  useEffect(() => { preloadCountries(); }, []);

  // Global heatmap — load for current year, update canvas texture reactively
  const currentYearRef = useRef(climate.tempAnomaly); // reuse as year proxy via prop
  useEffect(() => {
    const yearToLoad = year;

    // Subscribe to progressive updates
    const unsub = onHeatmapUpdate(async (anomalies: AnomalyMap) => {
      const s = sceneRef.current;
      if (!s) return;
      const canvas = await renderHeatmapToCanvas(anomalies);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      s.uniforms.uHeatmapTexture.value = tex;
      // Fade in as data arrives: opacity = fraction of countries with data
      const coverage = Math.min(1, anomalies.size / 150);
      s.uniforms.uHeatmapOpacity.value = coverage * 0.85;
    });

    loadGlobalHeatmap(yearToLoad);

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(year)]);

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
    camera.position.set(0, 0, isMobile ? 9.0 : 4.8);

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
      uDayTexture:      { value: dayTex },
      uCloudsTexture:   { value: cloudsTex },
      uHeatmapTexture:  { value: new THREE.Texture() },
      uHeatmapOpacity:  { value: 0 },
      uTime:          { value: 0 },
      uTemperature:   { value: climate.temperature },
      uCO2:           { value: climate.co2 },
      uIceMelt:       { value: climate.iceMelt },
      uDeforestation: { value: climate.deforestation },
      uSeaLevel:      { value: climate.seaLevel },
      uTempAnomaly:   { value: 0 },
    };

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 128),
      new THREE.ShaderMaterial({ vertexShader: earthVertexShader, fragmentShader: earthFragmentShader, uniforms })
    );
    scene.add(earth);

    // ── Atmosphere — single soft glow, tight to surface ───────────────────────
    const atmoUniforms = { uCO2: uniforms.uCO2, uTemperature: uniforms.uTemperature };
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: atmoUniforms,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    ));

    // ── Store refs for raycasting ─────────────────────────────────────────────
    threeRef.current = { camera, earth };

    // ── Drag / touch to rotate + click detection ──────────────────────────────
    let drag = false;
    let prev = { x: 0, y: 0 };
    let vel  = { x: 0, y: 0 };
    let downPos = { x: 0, y: 0 }; // track pointer-down position for click detection

    const CLICK_THRESHOLD = 5; // max px movement to count as click

    const handleGlobeClick = (clientX: number, clientY: number) => {
      if (!threeRef.current) return;
      const { camera: cam, earth: globe } = threeRef.current;

      // Raycast to find intersection with earth sphere
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cam);

      const intersects = raycaster.intersectObject(globe);
      if (intersects.length === 0) return;

      // Convert intersection point to lat/lon (accounting for earth rotation)
      const localPoint = globe.worldToLocal(intersects[0].point.clone());
      const { lat, lon } = spherePointToLatLon(localPoint);

      // Look up country (async)
      findCountryAt(lat, lon).then(country => {
        if (country && callbackRef.current) {
          callbackRef.current(country);
        }
      });
    };

    const onDown = (e: MouseEvent) => {
      drag = true;
      prev = { x: e.clientX, y: e.clientY };
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CLICK_THRESHOLD) {
        handleGlobeClick(e.clientX, e.clientY);
      }
      drag = false;
    };
    const onMove = (e: MouseEvent) => {
      if (!drag) return;
      vel.y = (e.clientX - prev.x) * 0.005;
      vel.x = (e.clientY - prev.y) * 0.005;
      prev  = { x: e.clientX, y: e.clientY };
    };
    const onTouchStart = (e: TouchEvent) => {
      drag = true;
      prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      downPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touch) {
        const dx = touch.clientX - downPos.x;
        const dy = touch.clientY - downPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CLICK_THRESHOLD) {
          handleGlobeClick(touch.clientX, touch.clientY);
        }
      }
      drag = false;
    };
    const onTouchMove  = (e: TouchEvent) => {
      if (!drag) return;
      e.preventDefault();
      vel.y = (e.touches[0].clientX - prev.x) * 0.005;
      vel.x = (e.touches[0].clientY - prev.y) * 0.005;
      prev  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    renderer.domElement.addEventListener("mousedown",  onDown);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove",  onTouchMove,  { passive: false });
    renderer.domElement.addEventListener("touchend",   onTouchEnd);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("mousemove", onMove);

    // ── Hover tooltip — show country name on mouseover ────────────────────────
    const tooltip = tooltipRef.current;
    let hoverThrottle = 0;
    let lastHovered = "";

    const onHover = (e: MouseEvent) => {
      if (drag || !threeRef.current || !tooltip) return;

      // Throttle raycasting to ~60ms
      const now = performance.now();
      if (now - hoverThrottle < 60) return;
      hoverThrottle = now;

      const { camera: cam, earth: globe } = threeRef.current;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cam);
      const intersects = raycaster.intersectObject(globe);

      if (intersects.length === 0) {
        tooltip.style.opacity = "0";
        renderer.domElement.style.cursor = "grab";
        lastHovered = "";
        return;
      }

      const localPoint = globe.worldToLocal(intersects[0].point.clone());
      const { lat, lon } = spherePointToLatLon(localPoint);

      findCountryAt(lat, lon).then(country => {
        if (!tooltip) return;
        if (country) {
          if (country.name !== lastHovered) {
            tooltip.textContent = country.name;
            lastHovered = country.name;
          }
          tooltip.style.left = `${e.clientX + 14}px`;
          tooltip.style.top = `${e.clientY - 10}px`;
          tooltip.style.opacity = "1";
          renderer.domElement.style.cursor = "pointer";
        } else {
          tooltip.style.opacity = "0";
          renderer.domElement.style.cursor = "grab";
          lastHovered = "";
        }
      });
    };

    renderer.domElement.addEventListener("mousemove", onHover);

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
      renderer.domElement.removeEventListener("mousedown",  onDown);
      renderer.domElement.removeEventListener("mousemove",  onHover);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize",    onResize);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove",  onTouchMove);
      renderer.domElement.removeEventListener("touchend",   onTouchEnd);
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
    s.uniforms.uTempAnomaly.value   = climate.tempAnomaly;
  }, [climate]);

  return (
    <>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          pointerEvents: "none",
          zIndex: 50,
          opacity: 0,
          transition: "opacity 0.15s ease",
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          fontSize: 13,
          fontFamily: "'Space Grotesk', sans-serif",
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.15)",
          whiteSpace: "nowrap",
        }}
      />
    </>
  );
}
