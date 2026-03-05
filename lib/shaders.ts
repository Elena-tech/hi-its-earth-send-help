// Earth vertex shader
export const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Earth fragment shader — procedural land/ocean with climate overlay
export const earthFragmentShader = `
  uniform float uTime;
  uniform float uTemperature;   // 0.0 = pre-industrial, 1.0 = +4°C
  uniform float uCO2;           // 0.0 = 280ppm, 1.0 = 800ppm
  uniform float uIceMelt;       // 0.0 = full ice, 1.0 = no ice
  uniform float uDeforestation; // 0.0 = pristine, 1.0 = stripped
  uniform float uSeaLevel;      // 0.0 = normal, 1.0 = +2m

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  // Hash / noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  // Sphere → lat/lon
  vec2 latlon(vec2 uv) {
    return vec2((uv.y - 0.5) * 3.14159, (uv.x - 0.5) * 6.28318);
  }

  void main() {
    vec2 uv = vUv;

    // Procedural continent mask
    float cont = fbm(uv * 3.5 + vec2(1.3, 0.7));
    cont += fbm(uv * 7.0 + vec2(3.1, 1.9)) * 0.3;
    float isLand = smoothstep(0.48, 0.52, cont);

    // Latitude (0 = equator, 1 = poles)
    float lat = abs(uv.y - 0.5) * 2.0;

    // Sea level rise — flood low coastal land
    float coastalFlood = smoothstep(0.48, 0.50 + uSeaLevel * 0.03, cont);
    isLand = mix(isLand, coastalFlood, uSeaLevel * 0.8);

    // === BASE COLOURS ===
    // Ocean — deep blue to warming teal/brown
    vec3 oceanDeep  = vec3(0.02, 0.08, 0.25);
    vec3 oceanWarm  = vec3(0.10, 0.18, 0.22);
    vec3 ocean = mix(oceanDeep, oceanWarm, uTemperature * 0.8);

    // Land — green to brown/grey as deforestation increases
    vec3 forest   = vec3(0.08, 0.28, 0.08);
    vec3 barren   = vec3(0.38, 0.28, 0.15);
    vec3 desert   = vec3(0.55, 0.42, 0.22);
    float forestFade = uDeforestation + fbm(uv * 12.0) * 0.3 * uDeforestation;
    vec3 land = mix(forest, mix(barren, desert, uTemperature), clamp(forestFade, 0.0, 1.0));

    // Temperature heatmap tint on land
    vec3 heatTint = vec3(0.9, 0.15, 0.0);
    land = mix(land, heatTint, uTemperature * 0.35);

    // Base colour
    vec3 colour = mix(ocean, land, isLand);

    // === ICE CAPS ===
    float iceLine = mix(0.82, 0.40, uIceMelt); // ice retreats toward poles
    float iceBlend = fbm(uv * 9.0) * 0.12;
    float hasIce = smoothstep(iceLine - 0.08 + iceBlend, iceLine + iceBlend, lat);
    vec3 iceColour = mix(vec3(0.85, 0.92, 1.0), vec3(0.6, 0.65, 0.55), uTemperature * 0.6);
    colour = mix(colour, iceColour, hasIce);

    // === CITY LIGHTS (night side) ===
    vec3 lightDir = normalize(vec3(1.0, 0.3, 0.5));
    float daylight = dot(vNormal, lightDir);
    float nightSide = smoothstep(0.0, -0.3, daylight);
    float cityDensity = fbm(uv * 25.0 + vec2(0.5)) * isLand;
    vec3 cityGlow = vec3(1.0, 0.85, 0.5) * cityDensity * nightSide * 1.2;
    colour += cityGlow;

    // === SUNLIGHT ===
    float diffuse = max(0.0, daylight);
    float ambient = 0.12;
    colour *= (ambient + diffuse * 0.88);

    // Specular on ocean
    vec3 viewDir = normalize(-vPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 120.0) * (1.0 - isLand) * 0.8;
    colour += vec3(0.8, 0.9, 1.0) * spec;

    // === CO2 HAZE (brownish atmospheric tint at horizon) ===
    float edgeFade = 1.0 - abs(dot(vNormal, viewDir));
    edgeFade = pow(edgeFade, 2.5);
    vec3 co2Haze = mix(vec3(0.2, 0.5, 0.9), vec3(0.6, 0.35, 0.05), uCO2);
    colour = mix(colour, co2Haze, edgeFade * 0.25 * (0.3 + uCO2 * 0.7));

    gl_FragColor = vec4(colour, 1.0);
  }
`;

// Atmosphere glow shader
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
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - abs(dot(vNormal, viewDir));
    rim = pow(rim, 3.0);

    // Clean air = blue; polluted = murky orange
    vec3 cleanAtmo  = vec3(0.3, 0.6, 1.0);
    vec3 dirtyAtmo  = vec3(0.7, 0.4, 0.1);
    vec3 atmoColour = mix(cleanAtmo, dirtyAtmo, uCO2 * uCO2);

    gl_FragColor = vec4(atmoColour, rim * 0.7);
  }
`;

// Stars vertex
export const starsVertexShader = `
  attribute float aSize;
  attribute float aBrightness;
  varying float vBrightness;
  void main() {
    vBrightness = aBrightness;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
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
