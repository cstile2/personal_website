// Get the canvas and WebGL2 context
// const canvas = document.getElementById("glcanvas");
// const gl = canvas.getContext("webgl2");
// function resizeGLCanvasToDisplaySize(canvas, gl) {
//     const displayWidth  = canvas.clientWidth;
//     const displayHeight = canvas.clientHeight;
//     if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
//         canvas.width = displayWidth;
//         canvas.height = displayHeight;
//         gl.viewport(0, 0, canvas.width, canvas.height);
//     }
// }

// // Initial resize
// resizeGLCanvasToDisplaySize(canvas, gl);

// // Resize on window resize
// window.addEventListener('resize', () => {
//     resizeGLCanvasToDisplaySize(canvas, gl);
// });

// if (!gl) {
//     alert("WebGL2 is not supported by your browser.");
//     throw new Error("WebGL2 not supported");
// }

// // Vertex shader (outputs UV to the fragment shader)
// const vertexShaderSource = `#version 300 es
// in vec2 a_position;
// out vec2 v_uv;

// void main() {
//     v_uv = a_position * 0.5 + 0.5; // Map from [-1,1] to [0,1]
//     gl_Position = vec4(a_position, 0.0, 1.0);
// }`;

// // Fragment shader (uses UV as color)
// const fragmentShaderSource = `#version 300 es
// precision highp float;
// in vec2 v_uv;
// out vec4 outColor;

// uniform float time;

// vec4 permute(vec4 t) {
//     return t * (t * 34.0 + 133.0);
// }

// // Gradient set is a normalized expanded rhombic dodecahedron
// vec3 grad(float hash) {
    
//     // Random vertex of a cube, +/- 1 each
//     vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0;
    
//     // Random edge of the three edges connected to that vertex
//     // Also a cuboctahedral vertex
//     // And corresponds to the face of its dual, the rhombic dodecahedron
//     vec3 cuboct = cube;
//     cuboct[int(hash / 16.0)] = 0.0;
    
//     // In a funky way, pick one of the four points on the rhombic face
//     float type = mod(floor(hash / 8.0), 2.0);
//     vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));
    
//     // Expand it so that the new edges are the same length
//     // as the existing ones
//     vec3 grad = cuboct * 1.22474487139 + rhomb;
    
//     // To make all gradients the same length, we only need to shorten the
//     // second type of vector. We also put in the whole noise scale constant.
//     // The compiler should reduce it into the existing floats. I think.
//     grad *= (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;
    
//     return grad;
// }

// // BCC lattice split up into 2 cube lattices
// vec4 os2NoiseWithDerivativesPart(vec3 X) {
//     vec3 b = floor(X);
//     vec4 i4 = vec4(X - b, 2.5);
    
//     // Pick between each pair of oppposite corners in the cube.
//     vec3 v1 = b + floor(dot(i4, vec4(.25)));
//     vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35)));
//     vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35)));
//     vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35)));
    
//     // Gradient hashes for the four vertices in this half-lattice.
//     vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0));
//     hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0));
//     hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0);
    
//     // Gradient extrapolations & kernel function
//     vec3 d1 = X - v1; vec3 d2 = X - v2; vec3 d3 = X - v3; vec3 d4 = X - v4;
//     vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0);
//     vec4 aa = a * a; vec4 aaaa = aa * aa;
//     vec3 g1 = grad(hashes.x); vec3 g2 = grad(hashes.y);
//     vec3 g3 = grad(hashes.z); vec3 g4 = grad(hashes.w);
//     vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4));
    
//     // Derivatives of the noise
//     vec3 derivative = -8.0 * mat4x3(d1, d2, d3, d4) * (aa * a * extrapolations)
//         + mat4x3(g1, g2, g3, g4) * aaaa;
    
//     // Return it all as a vec4
//     return vec4(derivative, dot(aaaa, extrapolations));
// }

// // Rotates domain, but preserve shape. Hides grid better in cardinal slices.
// // Good for texturing 3D objects with lots of flat parts along cardinal planes.
// vec4 os2NoiseWithDerivatives_Fallback(vec3 X) {
//     X = dot(X, vec3(2.0/3.0)) - X;
    
//     vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);
    
//     return vec4(dot(result.xyz, vec3(2.0/3.0)) - result.xyz, result.w);
// }

// // Gives X and Y a triangular alignment, and lets Z move up the main diagonal.
// // Might be good for terrain, or a time varying X/Y plane. Z repeats.
// vec4 os2NoiseWithDerivatives_ImproveXY(vec3 X) {
    
//     // Not a skew transform.
//     mat3 orthonormalMap = mat3(
//         0.788675134594813, -0.211324865405187, -0.577350269189626,
//         -0.211324865405187, 0.788675134594813, -0.577350269189626,
//         0.577350269189626, 0.577350269189626, 0.577350269189626);
    
//     X = orthonormalMap * X;
//     vec4 result = os2NoiseWithDerivativesPart(X) + os2NoiseWithDerivativesPart(X + 144.5);
    
//     return vec4(result.xyz * orthonormalMap, result.w);
// }

// void main() {
//     //outColor = vec4(v_uv, 0.0, 1.0); // R = U, G = V, B = 0
//     vec2 p = gl_FragCoord.xy;
//     vec3 X = vec3(p/700.0, time*0.05);

//     vec3 _x = vec3(p/5.0, -time*0.5);
    
//     // Evaluate noise
//     vec4 n = os2NoiseWithDerivatives_ImproveXY(X);
//     vec4 _n = os2NoiseWithDerivatives_ImproveXY(_x);

//     vec2 _p = p/70.0 + n.xy * 0.9;
//     vec3 a = vec3(0.05,0.12, 0.25);
//     vec3 b = vec3(1.0,0.1,0.0);
//     vec3 col = mix(a,b, sin(_p.x) * 0.5 + _n.w * 0.025) * 0.5;
//     col += _n.www * 0.009;
//     col = vec3(pow( col.x, 1.0/2.2 ),pow( col.y, 1.0/2.2 ),pow( col.z, 1.0/2.2 ));

//     outColor = vec4(col,1);
// }`;

// // Helper to compile shaders
// function compileShader(gl, source, type) {
//     const shader = gl.createShader(type);
//     gl.shaderSource(shader, source);
//     gl.compileShader(shader);
//     if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
//         console.error(gl.getShaderInfoLog(shader));
//         gl.deleteShader(shader);
//         throw new Error("Shader compile failed");
//     }
//     return shader;
// }

// // Create program
// const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
// const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
// const program = gl.createProgram();
// gl.attachShader(program, vertexShader);
// gl.attachShader(program, fragmentShader);
// gl.linkProgram(program);
// if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
//     console.error(gl.getProgramInfoLog(program));
//     throw new Error("Program link failed");
// }

// // Fullscreen quad using two triangles
// const vertices = new Float32Array([
//     -1, -1,
//      1, -1,
//     -1,  1,
//     -1,  1,
//      1, -1,
//      1,  1,
// ]);

// const vao = gl.createVertexArray();
// gl.bindVertexArray(vao);

// const positionBuffer = gl.createBuffer();
// gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
// gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// const a_position = gl.getAttribLocation(program, "a_position");
// gl.enableVertexAttribArray(a_position);
// gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

// // Draw
// gl.viewport(0, 0, canvas.width, canvas.height);
// gl.clearColor(0, 0, 0, 1);
// gl.clear(gl.COLOR_BUFFER_BIT);
// gl.useProgram(program);
// gl.bindVertexArray(vao);

// const timeUniformLocation = gl.getUniformLocation(program, "time");

// requestAnimationFrame(animate);

// var time_ = 0.0;
// function animate() {
//     time_ += 0.1
//     gl.drawArrays(gl.TRIANGLES, 0, 6);
//     gl.uniform1f(timeUniformLocation, time_); // Update uniform
//     // requestAnimationFrame(animate);
// }

const srcs = ["assets/videos/beach.mp4", "assets/videos/canada.mp4", "assets/videos/clouds.mp4", "assets/videos/mountains.mp4", "assets/videos/field.mp4", "assets/videos/stars.mp4"]

let index = 0;
function change() {
    index += 1;
    while (index >= srcs.length) {
        index -= srcs.length;
    }

    document.getElementById("glcanvas").src = srcs[index];
}

const id = setInterval(change, 5000);

// document.getElementById("glcanvas").src = "assets/videos/canada.mp4";
