var gl;

/** 
 * Helper function that compiles a shader
 * @function
 */
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

/**
 * Creates an instance of Constraint. This constraint will be used as rule for
 * modifying two particles. It will be satisfied or unsatisfied.
 * @class
 * @param {number} particleA First particle to constrain.
 * @param {number} particleB Second particle to constrain.
 * @param {number} restlength Rest length between the particles.
 */
function Constraint(particleA, particleB, restlength) {
  this.A = particleA;
  this.B = particleB;
  this.restlength = restlength;
}

/**
 * Creates an instance of ParticleSystem
 * @class
 * @param {string} canvasId The canvas id associated with the particle system.
 */
function ParticleSystem(canvasId) {
  this.NUM = 0;
  this.NUM_ITERATIONS = 1;

  var canvas = document.getElementById(canvasId);
  this.w = canvas.width = canvas.offsetWidth;
  this.h = canvas.height = canvas.offsetHeight;
  gl = canvas.getContext('webgl');

  this.curPositions = [];
  this.oldPositions = [];
  this.posData = [];
  this.conData = [0,1];
  this.forceAccumulators = [];
  this.gravity = {x: 0, y: -9.8}; 
  this.timeStep = 1.0;
  this.constraints = [];

  this.initializeGL();

  // Events Setup
  var onResizeCallback = function () {
    this.w = canvas.width = canvas.offsetWidth;
    this.h = canvas.height = canvas.offsetHeight;
    gl.viewport(0, 0, this.w, this.h)
  }

  var onClickCallback = function (ev) {
    switch (ev.button) { 
      case 0: // LEFT
        this.addParticle(ev.x, this.h - ev.y);  
        break;
      case 1: // MIDDLE
        var pos1 = { x: ev.x, y: this.h - ev.y };  
        var pos2 = {
          x: ev.x + 200 * (Math.random() * 2.0 - 1.0),
          y: this.h - ev.y - 200 * (Math.random() * 2.0 - 1.0)
        };
        
        var d = { x: pos2.x - pos1.x, y: pos2.y - pos1.y };
        var len = Math.sqrt(d.x * d.x + d.y * d.y);

        this.addParticle(pos1.x, pos1.y);
        this.addParticle(pos2.x, pos2.y);
        this.constraints.push(new Constraint(this.NUM - 1, this.NUM - 2, len));
      default:
        break;  
    }
  }

  canvas.addEventListener('click', onClickCallback.bind(this));
  window.addEventListener('onresize', onResizeCallback.bind(this));
}

/**
 * Places a new particle at a given position.
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.addParticle = function (x, y) { 
  var particle = { x: x, y: y };
  this.curPositions.push(particle);
  this.oldPositions.push(particle);
  this.NUM += 1;
}

/**
 * Initializes all the WebGL-related operations
 * @memberof ParticleSystem
 */
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
  this.constraintsEBO = gl.createBuffer();

  this.curPositions.forEach(function (pos) { 
    this.posData.push(pos.x, pos.y);
  }, this)

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.posData), gl.STATIC_DRAW);
  gl.viewport(0, 0, this.w, this.h);
}

/**
 * Draws all the particles in the scene.
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.draw = function() {
  gl.clearColor(0.23, 0.29, 0.25, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(this.program);
  gl.enableVertexAttribArray(this.positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.constraintsEBO);

  gl.vertexAttribPointer(this.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(this.resolutionUniformLocation, this.w, this.h);
  gl.drawArrays(gl.POINTS, 0, this.NUM);
  gl.drawElements(gl.LINES, this.constraints.length * 2, gl.UNSIGNED_BYTE, 0);
}

/**
 * Accumulates forces for each particle
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.accumulateForces = function() {
  for (var i = 0; i < this.curPositions.length; i++) {
    this.forceAccumulators[i] = this.gravity;
  }
}

/**
 * Perform the Verlet integration step
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.verlet = function () {
  for (var i = 0; i < this.curPositions.length; i++) {
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

/** All the constraints will be satisfied
 * @memberof ParticleSystem
 **/
ParticleSystem.prototype.satisfyConstraints = function () {
  for (var it = 0; it < this.NUM_ITERATIONS; it++) {
    // Satisfy first constraint (box bounds)
    for (var i = 0; i < this.curPositions.length; i++) {
      var pos = this.curPositions[i];
      pos.x = Math.min(Math.max(pos.x, 0), this.w);
      pos.y = Math.min(Math.max(pos.y, 0), this.h);
    }

    for (var i = 0; i < this.constraints.length; i++) { 
      var c = this.constraints[i];

      var pos1 = this.curPositions[c.A];
      var pos2 = this.curPositions[c.B];

      var delta = { x: pos2.x - pos1.x, y: pos2.y - pos1.y };
      
      // OPTIMIZED (GETTING RID OF SQUARE ROOT)
      // delta.x *= c.restlength * c.restlength / (delta.x * delta.x + c.restlength * c.restlength) - 0.5;
      // delta.y *= c.restlength * c.restlength / (delta.y * delta.y + c.restlength * c.restlength) - 0.5;

      // pos1.x -= delta.x;
      // pos1.y -= delta.y;
      
      // pos2.x += delta.x;
      // pos2.y += delta.y;
      // UNOPTIMIZED
      var deltalength = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
      var diff = (deltalength - c.restlength) / deltalength;
    
      pos1.x += delta.x * 0.5 * diff;
      pos1.y += delta.y * 0.5 * diff;

      pos2.x -= delta.x * 0.5 * diff;
      pos2.y -= delta.y * 0.5 * diff;

      this.curPositions[c.A] = pos1;
      this.curPositions[c.B] = pos2;
    }
  }
}  

/** Packs all data into single flat array and sends it to client
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.sendDataToGL = function () { 
  this.posData = [];

  this.curPositions.forEach(function (pos) {
    this.posData.push(pos.x, pos.y);
  }, this);

  this.conData = [];
  this.constraints.forEach(function (con) {
    this.conData.push(con.A, con.B);
  }, this);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.posData), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.constraintsEBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(this.conData), gl.STATIC_DRAW);
}

/**
 * Perform a substep
 * @memberof ParticleSystem
 **/
ParticleSystem.prototype.step = function () {
  this.accumulateForces();
  this.verlet();
  this.satisfyConstraints();
  this.sendDataToGL();
  this.draw();
}

// Main execution
var ps = new ParticleSystem('screen');
ps.addParticle(200, window.innerHeight-200);
ps.addParticle(10, window.innerHeight + 200);
ps.addParticle(310, window.innerHeight+200);
ps.constraints.push(new Constraint(0, 1, 300.0));
setInterval(ps.step.bind(ps), 20);