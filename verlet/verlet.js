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

// Particle system constructor
function ParticleSystem(canvasId) {
  this.NUM = 2;
  this.NUM_ITERATIONS = 1;

  var canvas = document.getElementById(canvasId);
  this.w = canvas.width = canvas.offsetWidth;
  this.h = canvas.height = canvas.offsetHeight;
  gl = canvas.getContext('webgl');

  this.curPositions = [{ x: 10, y: this.h }, { x: 140, y: this.h-40 }];
  this.oldPositions = [{ x: 10, y: this.h }, { x: 140, y: this.h-40 }];
  this.posData = [];
  this.forceAccumulators = [{ x: 0.0, y: -9.8 }, { x: 0.0, y: -9.8 }];
  this.gravity = [0.0, -2.0];
  this.timeStep = 1.0;

  this.initializeGL();

  var onResizeCallback = function () {
    this.w = canvas.width = canvas.offsetWidth;
    this.h = canvas.height = canvas.offsetHeight;
    gl.viewport(0, 0, this.w, this.h)
  }

  window.onresize = onResizeCallback.bind(this);
}

// Initializes all the WebGL-related operations
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

  this.curPositions.forEach(function (pos) { 
    this.posData.push(pos.x, pos.y);
  }, this)

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.posData), gl.STATIC_DRAW);
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
  gl.drawArrays(gl.POINTS, 0, this.curPositions.length);
}

// Accumulates forces for each particle
ParticleSystem.prototype.accumulateForces = function() {
  for (var i = 0; i < this.NUM; i++) {
    this.accumulateForces[i] = this.gravity;
  }
}

// Perform the Verlet integration step
ParticleSystem.prototype.verlet = function () {
  for (var i = 0; i < this.NUM; i++) {
    var pos = this.curPositions[i];
    var temp = pos;

    var oldpos = this.oldPositions[i];
    var a = this.forceAccumulators[i];

    pos.x = 2 * pos.x - oldpos.x + a.x * this.timeStep * this.timeStep;
    pos.y = 2 * pos.y - oldpos.y + a.y * this.timeStep * this.timeStep;

    this.curPositions[i] = pos;
    this.oldPositions[i] = temp;
  }
}

// All the constraints will be satisfied
ParticleSystem.prototype.satisfyConstraints = function () {
  for (var it = 0; it < this.NUM_ITERATIONS; it++) {
    // Satisfy first constraint (box bounds)
    for (var i = 0; i < this.NUM; i++) {
      var pos = this.curPositions[i];
      pos.x = Math.min(Math.max(pos.x, 0), this.w);
      pos.y = Math.min(Math.max(pos.y, 0), this.h);
    }

    // Satisfy second constraint (stick)
    var restlength = 140.0;
    var pos1 = this.curPositions[0];
    var pos2 = this.curPositions[1];
    var delta = { x: pos2.x - pos1.x, y: pos2.y - pos1.y };
    var deltalength = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    var diff = (deltalength - restlength) / deltalength;
  
    pos1.x += delta.x * 0.5 * diff;
    pos1.y += delta.y * 0.5 * diff;

    pos2.x -= delta.x * 0.5 * diff;
    pos2.y -= delta.y * 0.5 * diff;

    this.curPositions[0] = pos1;
    this.curPositions[1] = pos2;
  }
}  

// Packs all data into single flat array and sends it to client
ParticleSystem.prototype.sendDataToGL = function () { 
  this.posData = [];

  this.curPositions.forEach(function (pos) {
    this.posData.push(pos.x, pos.y);
  }, this);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.posData), gl.STATIC_DRAW);
}

// Perform a substep
ParticleSystem.prototype.step = function () {
  this.accumulateForces();
  this.verlet();
  this.satisfyConstraints();
  this.sendDataToGL();
  this.draw();
}

var ps = new ParticleSystem('screen');

setInterval(ps.step.bind(ps), 20);