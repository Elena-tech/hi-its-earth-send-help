// ── Earth ─────────────────────────────────────────────────────────────────────
export const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv      = uv;
    vNormal  = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const earthFragmentShader = `
  precision highp float;

  uniform sampler2D uDayTexture;

  uniform sampler2D uCloudsTexture;

  uniform float uTime;
  uniform float uTemperature;   // 0 = pre-industrial, 1 = +4°C
  uniform float uCO2;           // 0 = 280ppm, 1 = 800ppm
  uniform float uIceMelt;       // 0 = full ice caps, 1 = no ice
  uniform float uDeforestation; // 0 = pristine, 1 = stripped
  uniform float uSeaLevel;      // 0 = normal, 1 = +2m

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  // Noise for ice edge / cloud variation
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
  }
  float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}

  void main() {
    vec3 viewDir = normalize(-vPosition);
    vec3 sunDir  = normalize(vec3(2.0, 0.5, 1.5));

    // ── Base textures ─────────────────────────────────────────────────────────
    vec3 dayColor   = texture2D(uDayTexture,    vUv).rgb;
    float clouds    = texture2D(uCloudsTexture, vUv).r;

    // Bump cloud layer (slow drift) — fract() ensures seamless wrap
    vec2 cloudUv = fract(vUv + vec2(uTime * 0.002, 0.0));
    float cloudLayer = texture2D(uCloudsTexture, cloudUv).r;

    // ── Day/night blend ───────────────────────────────────────────────────────
    float daylight = dot(vNormal, sunDir);
    float dayFrac  = smoothstep(-0.15, 0.35, daylight);

    // Procedural city lights (night side)
    float cityDensity = fbm(vUv * 35.0 + vec2(0.5)) * smoothstep(0.48, 0.52, dayColor.g);
    vec3 nightGlow = vec3(1.0, 0.85, 0.5) * cityDensity * 1.8; // Warm city glow
    vec3 base = mix(nightGlow * 0.6, dayColor, dayFrac);

    // ── Climate effects on land colour ────────────────────────────────────────
    // Detect greenery (high green, low red/blue) — forests
    float greenness = smoothstep(0.0, 0.3, dayColor.g - max(dayColor.r, dayColor.b));
    // Heat tint — shift green land toward brown/orange
    vec3 heatTint = vec3(0.55, 0.25, 0.05);
    base = mix(base, mix(base, heatTint, 0.6), greenness * uDeforestation);
    // Additional warming redness on all land
    float isLand = 1.0 - smoothstep(0.05, 0.2, dayColor.b - dayColor.r);
    vec3 warmTint = vec3(0.7, 0.3, 0.1);
    base = mix(base, mix(base, warmTint, 0.4 * isLand), uTemperature * 0.5);

    // ── Sea level rise — darken/blue coastal areas ────────────────────────────
    float shallowOcean = smoothstep(0.1, 0.25, dayColor.b) * (1.0 - isLand);
    vec3 floodColor = vec3(0.04, 0.12, 0.35);
    float coastFlood = smoothstep(0.0, 0.5, isLand * (1.0 - smoothstep(0.0, 0.25, dayColor.b)));
    base = mix(base, floodColor, coastFlood * uSeaLevel * 0.6);

    // ── Ice caps ──────────────────────────────────────────────────────────────
    float lat = abs(vUv.y - 0.5) * 2.0; // 0=equator, 1=poles
    float iceEdge    = mix(0.80, 0.35, uIceMelt);
    float iceNoise   = fbm(vUv * 8.0) * 0.12;
    float iceFactor  = smoothstep(iceEdge - 0.08 + iceNoise, iceEdge + iceNoise, lat);
    vec3 iceColor    = mix(vec3(0.88, 0.94, 1.0), vec3(0.55, 0.60, 0.50), uTemperature * 0.5);
    base = mix(base, iceColor, iceFactor * dayFrac);

    // ── Clouds ────────────────────────────────────────────────────────────────
    float cloudAlpha = cloudLayer * 0.75;
    vec3 cloudColor  = mix(vec3(0.95, 0.97, 1.0), vec3(0.8, 0.7, 0.5), uCO2 * 0.4);
    base = mix(base, cloudColor, cloudAlpha * dayFrac);

    // ── Lighting ──────────────────────────────────────────────────────────────
    float diffuse = max(0.0, daylight);
    float ambient = 0.18;
    base *= (ambient + diffuse * 0.82);

    // Specular on ocean
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 80.0) * (1.0 - isLand) * (1.0 - cloudLayer) * 0.9;
    base += vec3(0.85, 0.92, 1.0) * spec;

    // ── CO₂ atmosphere edge tint ──────────────────────────────────────────────
    float rim = pow(1.0 - abs(dot(vNormal, viewDir)), 3.5);
    vec3 co2rim = mix(vec3(0.3, 0.6, 1.0), vec3(0.65, 0.35, 0.05), uCO2 * uCO2);
    base = mix(base, co2rim, rim * 0.18 * (0.4 + uCO2 * 0.6));

    gl_FragColor = vec4(base, 1.0);
  }
`;

// ── Atmosphere ────────────────────────────────────────────────────────────────
export const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = `
  uniform float uCO2;
  uniform float uTemperature;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - abs(dot(vNormal, viewDir));
    rim = pow(rim, 2.5);
    vec3 clean = vec3(0.25, 0.55, 1.0);
    vec3 dirty = vec3(0.65, 0.38, 0.08);
    vec3 colour = mix(clean, dirty, uCO2 * uCO2 * 0.85);
    // Cap opacity so planet always shows through
    gl_FragColor = vec4(colour, rim * 0.55);
  }
`;

// ── Stars ─────────────────────────────────────────────────────────────────────
export const starsVertexShader = `
  attribute float aSize;
  attribute float aBrightness;
  varying float vBrightness;
  void main() {
    vBrightness = aBrightness;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

export const starsFragmentShader = `
  varying float vBrightness;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d) * vBrightness;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;
