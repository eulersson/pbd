var gl;
var breakingThreshold = 200.0;

/** 
 * Helper function that compiles a shader.
 * @function
 * @param {object} gl WebGL context extracted from the canvas.
 * @param {enum} type Can be gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
 * @param {string} source GLSL text to compile.
 * @returns {object} Compiled shader.
 */
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

/**
 * Creates an instance of pin constraint. This constraint will be used as rule
 * for modifying two particles (projection). The pin constraint hard pins a
 * particle to a specific position in space.
 * @class
 * @param {number} A Index of the particle that needs to be constrained.
 * @param {number} x X position the particle needs to be hard constrained to.
 * @param {number} y Y position the particle needs to be hard constrained to.
 */
function PinConstraint(A, x, y) { 
  this.A = A;
  this.x = x;
  this.y = y;
}

/**
 * Adjusts the position of the particle associated with the constraint in
 * order to satisfy it. This method will get called in the
 * {@link ParticleSystem#satisfyConstraints}.
 * @param {list} curPositions The current list of particles so it can be modified.
 * @returns {boolean} If the constraint is still alive, in oder words if it does
 * not have to be deleted.
 */
PinConstraint.prototype.project = function(curPositions) {
  curPositions[this.A] = { x: this.x, y: this.y };
  return true;
}

/**
 * Creates an instance of pin constraint. This constraint will be used as rule
 * for modifying two particles (projection). The spring constraint defines the
 * distance that should exist between to particles through the rest length. The
 * stiffness determines how hard the constraint will act on the particles to try
 * to match the rest length.
 * @class
 * @param {number} A Index of the first particle to constrain.
 * @param {number} B Index of the xecond particle to constrain.
 * @param {number} restLength Rest length between the particles.
 * @param {number} stiffness  How hard the constraint will act.
 */
function SpringConstraint(A, B, restLength, stiffness) {
  this.A = A;
  this.B = B;
  this.restLength = restLength;
  this.stiffness = stiffness;
}

/**
 * Adjusts the positions of the particles associated with the constraint in
 * order to satisfy it. This method will get called in the
 * {@link ParticleSystem#satisfyConstraints}.
 * @param {list} curPositions The current list of particles so it can be modified.
 * @returns {boolean} If the constraint is still alive, in oder words if it does
 * not have to be deleted.
 */
SpringConstraint.prototype.project = function (curPositions) { 
  var pos1 = curPositions[this.A];
  var pos2 = curPositions[this.B];

  var delta = { x: pos2.x - pos1.x, y: pos2.y - pos1.y };
  var deltalength = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

  var diff = (deltalength - this.restLength) / deltalength;

  pos1.x += delta.x * 0.5 * this.stiffness * diff;
  pos1.y += delta.y * 0.5 * this.stiffness * diff;

  pos2.x -= delta.x * 0.5 * this.stiffness * diff;
  pos2.y -= delta.y * 0.5 * this.stiffness * diff;

  curPositions[this.A] = pos1;
  curPositions[this.B] = pos2;

  if (deltalength < breakingThreshold) {
    return true;
  } else {
    return false;
  }
}

/**
 * Creates an instance for a particle system and initializes all the WebGL
 * related commands so we can start drawing. It also sets event handlers.
 * @class
 * @param {string} canvasId The canvas id associated with the particle system.
 * @property {number} NUM_ITERATIONS The number of times to run the method to
 * satisfy the constraints.
 * @property {number} TIMESTEP Used for the velvet integration. The smaller the
 * more precise.
 * @property {list} curPositions Current positions of the particles in system.
 * @property {list} oldPositions Positions of the particles in the previous step.
 * @property {list} posData Particle positoins ready to be sent to WebGL.
 * @property {list} constraints List containing all the constraints. It might be
 * of type {@link PinConstraint} or {@link SpringConstraint}.
 * @property {conData} conData The constraints will be drawn too, so this stores
 * an array of indices of the posData that will be drawn using an EBO so we
 * don't send duplicate data to WebGL. For example [2,3,4,8] means there are two
 * constraints that need to be drawin, one drawing a line between particle with
 * index 2 and 3 and the other one between 4 and 8.
 * @property {object} gravity Has an x and y property to represent gravity. For
 * this example this is what will populate the force accumulators list. So each
 * element in the force accumulators list will have the same value as gravity.
 * @property {list} forceAccumulators List of forces represented as an object
 * with x and y properties that will be used by the verlet integration, before
 * the constraint projection, to advect the particles. Think of a force
 * accumulator as an external (not internal) force that acts on the particles.
 * @property {number} num_springs Stores how many constraints are of type
 * {@link SpringConstraint}, it's needed for drawing the right amount of lines.
 * @property {object} clickCon Click events create constraints dynamically. Once
 * a mouse down event is registered we look around the clicked point by a given
 * radius and if some particles exists within the range we append them to the
 * <code>constrained</code> property of this object as well as the
 * <code>x</code> and <code>y</code> coordinates of the mouse. If the mouse is
 * released the constraints will be removed from the system. And if the
 * <code>breakable</code> flag is true the spring constraints will be deleted if
 * they exceed 200px distance.
 * @property {number} w Width of the canvas (on resize glViewport is called).
 * @property {number} h Height of the canvas (on resize glViewport is called).
 */
function ParticleSystem(canvasId) {
  this.NUM_ITERATIONS = 1;
  this.TIMESTEP = 1.0;

  this.curPositions = [];
  this.oldPositions = [];
  this.posData = [];
  this.constraints = [];
  this.conData = [];

  this.gravity = {x: 0, y: -3.0}; 
  this.forceAccumulators = [];
  
  this.num_springs = 0;

  this.clickCon = {
    active: false,
    breakable: false,
    constrained: [],
    x: 0,
    y: 0,
    radius: 20,
  }

  var canvas = document.getElementById(canvasId);
  this.w = canvas.width = canvas.offsetWidth;
  this.h = canvas.height = canvas.offsetHeight;
  gl = canvas.getContext('webgl');

  this.initializeGL();

  // Events Setup
  var onResizeCallback = function () {
    this.w = canvas.width = canvas.offsetWidth;
    this.h = canvas.height = canvas.offsetHeight;
    gl.viewport(0, 0, this.w, this.h)
  }

  var onMouseMoveCallback = function(ev) {
    if (this.clickCon.active) {
      this.clickCon.x = ev.offsetX;
      this.clickCon.y = window.innerHeight - ev.offsetY;

      for (var i = 0; i < this.clickCon.constrained.length; i++) {
        var c = this.constraints[this.constraints.length-1-i];
        c.x = this.clickCon.x;
        c.y = this.clickCon.y;
      }
    } 
  }

  var onMouseDownCallback = function (ev) {
    this.clickCon.active = true;
    this.clickCon.x = ev.clientX;
    this.clickCon.y = window.innerHeight - ev.clientY;

    this.curPositions.forEach(function(pos, idx) {
      if (Math.abs(pos.x - this.clickCon.x) < this.clickCon.radius &&
          Math.abs(pos.y - this.clickCon.y) < this.clickCon.radius) {
        this.clickCon.constrained.push(idx);
        this.constraints.push(
          new PinConstraint(idx, this.clickCon.x, this.clickCon.y)
        );
      }
    }, this);
    this.clickCon.breakable = true;
    if (ev.button == 1) { // Middle click
      this.clickCon.breakable = false;
    }
  }

  var onMouseUpCallback = function(ev) {
    this.clickCon.active = false;
    for (var i = 0; i < this.clickCon.constrained.length; i++) {
      this.constraints.pop();
    }
    this.clickCon.constrained = [];
  }

  var onKeyDownCallback = function (ev) {
    switch(ev.keyCode) {
      case 38: // left arrow
        this.gravity.y += 0.1;
        break;
      case 40: // down arrow
        this.gravity.y -= 0.1;
        break;
      case 66: // B
        var breaking = prompt("Breaking threshold (in pixels)", "200");
        breakingThreshold = parseFloat(breaking);
        break;
      case 78: // N
        var iterations = prompt("How many iterations?", "1");
        this.NUM_ITERATIONS = parseInt(iterations);
        break;
      default:
        break;
    }
  }
  canvas.addEventListener('mousemove', onMouseMoveCallback.bind(this));
  canvas.addEventListener('mousedown', onMouseDownCallback.bind(this));
  canvas.addEventListener('mouseup', onMouseUpCallback.bind(this));
  window.addEventListener('keydown', onKeyDownCallback.bind(this));
  window.addEventListener('resize', onResizeCallback.bind(this));
}

/**
 * Places a new particle at a given position.
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.addParticle = function (x, y) { 
  var particle = { x: x, y: y };
  this.curPositions.push(particle);
  this.oldPositions.push(particle);
}

/**
 * Initializes all the WebGL-reladeltated operations
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
    console.error(gl.getProgramInfoLog(this.program));
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
  gl.drawArrays(gl.POINTS, 0, this.curPositions.length);
  gl.drawElements(gl.LINES, this.num_springs * 2, gl.UNSIGNED_SHORT, 0);
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

    pos.x = 2 * pos.x - oldpos.x + a.x * this.TIMESTEP * this.TIMESTEP;
    pos.y = 2 * pos.y - oldpos.y + a.y * this.TIMESTEP * this.TIMESTEP;

    this.curPositions[i] = pos;
    this.oldPositions[i] = temp;
  }
}

/**
 * All the constraints will be satisfied by modifying the current positions.
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

    // Satisfy rest of the constraints (pin or spring)
    for (var i = 0; i < this.constraints.length; i++) { 
      var alive = this.constraints[i].project(this.curPositions);
      if (!alive && this.clickCon.breakable) {
        // If constraint returns false means it should die (for example
        // exceeding) the distance threshold. If the user has also pressed the
        // left mouse button (so clickCon.breakable is true) we delete it.
        this.constraints.splice(i, 1);
      }
    }
  }
}  

/** Packs all data into single flat array and sends it to client WebGL.
 * @memberof ParticleSystem
 */
ParticleSystem.prototype.sendDataToGL = function () { 
  this.posData = [];

  this.curPositions.forEach(function (pos) {
    this.posData.push(pos.x, pos.y);
  }, this);

  this.conData = [];
  this.num_springs = 0;
  this.constraints.forEach(function (con) {
    if (con instanceof SpringConstraint) {
      this.conData.push(con.A);
      this.conData.push(con.B);
      this.num_springs += 1;
    }
  }, this);
  
  this.num_springs = this.conData.length / 2;

  gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.posData), gl.DYNAMIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.constraintsEBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.conData), gl.DYNAMIC_DRAW);
}

/**
 * This is basically the game loop. It accumulates the forces, then performs the
 * Velvet integration, then project all the positions so they satisfy the
 * constraints, then sends the data to the WebGL buffers so it's ready to be
 * drawn.
 * @memberof ParticleSystem
 **/
ParticleSystem.prototype.step = function () {
  this.accumulateForces();
  this.verlet();
  this.satisfyConstraints();
  this.sendDataToGL();
  this.draw();
}

// =============================================================================
// LET'S PLAY!
// =============================================================================
var ps = new ParticleSystem('screen');

// This creates a grid of particles connected following the rule:
//   1. If it is in the first row just connect to LEFT.
//   2. If it is in the first column DON'T' connect to LEFT.
//   3. If it is not in either first row or last row connect to LEFT and UP.
var cWidth = 25;
var cHeight = 20;
var rows = 40;
var cols = 40;
var startX = (window.innerWidth / 2.0) - (rows * cWidth) / 2.0;

for (var i = 0; i < rows; i++) { 
  for (var j = 0; j < cols; j++) { 
    var index = i * rows + j;
    var positionX = startX + j * cWidth;
    var positionY = window.innerHeight - (i * cHeight);
    
    ps.addParticle(positionX, positionY);

    if (i === 0) {  // first in the colum, dont link up, pin constrain
      ps.constraints.push(new PinConstraint(index, positionX, positionY));
      if (j === 0) { // do nothing

      } else {  // constraint just to left
        ps.constraints.push(new SpringConstraint(index, index - 1, cWidth - cWidth * 0.2, 1.0));
      }
    }
    else if (j === 0) { // first in the row, dont link left
      if (i === 0) {
        // do nothing
      } else {
        // constraint just to top
        ps.constraints.push(new SpringConstraint(index, index - cols, cHeight, 1.0));
      }
    } else { // constraint top and left
      ps.constraints.push(new SpringConstraint(index, index - cols, cHeight, 1.0));
      ps.constraints.push(new SpringConstraint(index, index - 1, cWidth - cWidth * 0.2, 0.8));
    }
  }
}

setInterval(ps.step.bind(ps), 20);  // Run the main loop.