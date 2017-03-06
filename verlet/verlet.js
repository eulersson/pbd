var gl;

// Helper function that compiles a shader
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.log(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// Constructor
function ParticleSystem(canvasId) {
  this.NUM = 2;
  this.curPositions = [];
  this.oldPositions = [];
  this.forceAccumulators = [];
  this.gravity = [0.0, -9.8];
  this.timeStep = 1.0;

  var canvas = document.getElementById(canvasId);
  this.w = canvas.width = canvas.offsetWidth;
  this.h = canvas.height = canvas.offsetHeight;
  gl = canvas.getContext('webgl');

  this.initializeGL();
}

// Initializes all the WebGL-corresponding operations
ParticleSystem.prototype.initializeGL = function() {
  var vertSource = document.getElementById('vert').text;
  var fragSource = document.getElementById('frag').text;

  var vertShader = createShader(gl, gl.VERTEX_SHADER, vertSource);
  var fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragSource);

  this.program = gl.createProgram();
  gl.attachShader(this.program, vertShader);
  gl.attachShader(this.program, fragShader);
  gl.linkProgram(this.program);

  var success = gl.getProgramParameter(this.program, gl.LINK_STATUS);
  if (!success) {
    console.log(gl.getProgramInfoLog(this.program));
  }

  this.positionAttributeLocation = gl.getAttribLocation(this.program, 'position');
  this.resolutionUniformLocation = gl.getUniformLocation(this.program, 'resolution');

  this.positionBuffer = gl.createBuffer();

  var positions = [
     30.0, 350.0,
     80.0, 350.0,
    500.0, 350.0,
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.viewport(0, 0, this.w, this.h);
}

// Draw scene
ParticleSystem.prototype.draw = function() {
  gl.clearColor(0.23, 0.29, 0.25, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(this.program);
  gl.enableVertexAttribArray(this.positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

  gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(this.resolutionUniformLocation, this.w, this.h);

  gl.drawArrays(gl.POINTS, 0, 3);
}

// Accumulates forces for each particle
ParticleSystem.prototype.accumulateForces = function() {
  for (var i = 0; i < this.NUM; i++) {
    this.accumulateForces[i] = this.gravity;
  }
}

// Perform the Verlet integration step
ParticleSystem.prototype.verlet = function() {

}

// All the constraints will be satisfied
ParticleSystem.prototype.satisfyConstraints = function() {

}

// Perform a substep
ParticleSystem.prototype.timeStep = function() {
  this.accumulateForces();
  this.verlet();
  this.satisfyConstraints();
  this.draw();
}

var ps = new ParticleSystem('screen');
setInterval(ps.draw.bind(ps), 3000);

/*
WebGL: INVALID_OPERATION: vertexAttribPointer: no bound ARRAY_BUFFER
ParticleSystem.draw @ verlet.js:95
verlet.js:96 WebGL: INVALID_OPERATION: drawArrays: no valid shader program in use
ParticleSystem.draw @ verlet.js:96
verlet.js:85 WebGL: INVALID_OPERATION: bufferData: no buffer
*/