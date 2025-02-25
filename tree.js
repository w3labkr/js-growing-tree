(function() {
  function TreePlugin(options) {
    options = options || {};
    this.container = options.container || document.body;
    // Fixed fullDepth for generating the complete tree structure internally
    this.fullDepth = 11;
    // Depth to display to the user (may be less than fullDepth)
    this.depth = options.depth || this.fullDepth;
    this.pixelRatio = window.devicePixelRatio > 1 ? 2 : 1;
    this.growthSpeed = options.growthSpeed || 1;
    this.treeScale = options.treeScale || 1;
    this.branchWidth = options.branchWidth || 1;
    this.colorMode = options.colorMode || "gradient";
    this.color = options.color || "#000";
    this.gradientStart = options.gradientStart || "#8B4513";
    this.gradientEnd = options.gradientEnd || "#228B22";
    this.seed = options.seed !== undefined ? Number(options.seed) : undefined;
    if (this.seed !== undefined) {
      var totalCount = 10000;
      this.randSeq = [];
      var s = this.seed;
      // Generate a deterministic random sequence using a linear congruential generator (LCG)
      for (var i = 0; i < totalCount; i++) {
        s = (s * 16807) % 2147483647;
        var rnd = (s - 1) / 2147483646;
        this.randSeq.push(rnd);
      }
      this.randCounter = 0;
    }
    this.canvas = document.createElement("canvas");
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.branches = [];
    this.animation = null;
    // currentDepth: the current depth level being animated (starting from the root)
    this.currentDepth = 0;
    this.addEventListeners();
    this.resize();
    // Start the tree with the root positioned at the middle-bottom of the container
    this.startTree(this.stageWidth / 2, this.stageHeight);
  }

  TreePlugin.prototype.addEventListeners = function () {
    // Listen for window resize events and call the resize method
    window.addEventListener("resize", this.resize.bind(this));
  };

  TreePlugin.prototype.resize = function () {
    // Update stage dimensions and canvas size according to the container
    this.stageWidth = this.container.clientWidth;
    this.stageHeight = this.container.clientHeight;
    this.canvas.width = this.stageWidth * this.pixelRatio;
    this.canvas.height = this.stageHeight * this.pixelRatio;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.clearCanvas();
  };

  TreePlugin.prototype.clearCanvas = function () {
    // Clear the entire canvas area
    this.ctx.clearRect(0, 0, this.stageWidth, this.stageHeight);
  };

  TreePlugin.prototype.startTree = function (posX, posY) {
    // Cancel any ongoing animation if exists
    if (this.animation) cancelAnimationFrame(this.animation);
    this.clearCanvas();
    if (this.seed !== undefined) {
      // Reset the random counter for deterministic results
      this.randCounter = 0;
    }
    // Create an array of branches for each depth level (size: fullDepth)
    this.branches = Array.from({ length: this.fullDepth }, function () { return []; });
    this.currentDepth = 0;
    this.treeTop = Infinity;
    this.treeX = posX;
    this.treeY = posY;
    // Limit the tree scale based on stage height and fullDepth
    var maxScale = this.stageHeight / (13 * this.fullDepth);
    if (this.treeScale > maxScale) {
      this.treeScale = maxScale;
    }
    // Generate the complete tree structure based on fullDepth (deterministic using seed)
    this.createBranch(this.treeX, this.treeY, -90, 0);
    // Initialize animation frames for each branch to 0
    for (var d = 0; d < this.fullDepth; d++) {
      for (var k = 0; k < this.branches[d].length; k++) {
        this.branches[d][k].cntFrame = 0;
      }
    }
    this.animate();
  };

  TreePlugin.prototype.random = function (min, max) {
    // Use deterministic random sequence if available; otherwise, fallback to Math.random()
    if (this.randSeq) {
      return min + this.randSeq[this.randCounter++] * (max - min);
    } else {
      return Math.random() * (max - min) + min;
    }
  };

  TreePlugin.prototype.degToRad = function (degree) {
    // Convert degrees to radians
    return degree * (Math.PI / 180);
  };

  TreePlugin.prototype.createBranch = function (startX, startY, angle, depth) {
    // Stop recursion when reaching the full depth
    if (depth === this.fullDepth) return;
    var scale = this.treeScale;
    // Calculate branch length; longer for the trunk (depth 0)
    var len = (depth === 0 ? this.random(10, 13) : this.random(0, 11)) * scale;
    var factor = this.fullDepth - depth;
    // Determine end coordinates based on angle, length, and scaling factor
    var endX = startX + Math.cos(this.degToRad(angle)) * len * factor;
    var endY = startY + Math.sin(this.degToRad(angle)) * len * factor;
    // Update the top position of the tree if necessary
    if (startY < this.treeTop) this.treeTop = startY;
    if (endY < this.treeTop) this.treeTop = endY;
    var branchWidthFactor = this.branchWidth;
    // Create a branch object with properties and a draw method
    var branch = {
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      lineWidth: factor * branchWidthFactor,
      frame: 100,
      cntFrame: 0,
      gapX: (endX - startX) / 100,
      gapY: (endY - startY) / 100,
      plugin: this,
      draw: function (ctx, speed) {
        // Draw the branch gradually until it is fully drawn
        if (this.cntFrame < this.frame) {
          ctx.beginPath();
          var progress = this.cntFrame / this.frame;
          var currX = this.startX + (this.endX - this.startX) * progress;
          var currY = this.startY + (this.endY - this.startY) * progress;
          ctx.moveTo(this.startX, this.startY);
          ctx.lineTo(currX, currY);
          ctx.lineWidth = this.lineWidth;
          // Set stroke style based on color mode (gradient or solid)
          if (this.plugin.colorMode === "gradient") {
            var grad = ctx.createLinearGradient(this.plugin.treeX, this.plugin.treeY, this.plugin.treeX, this.plugin.treeTop);
            grad.addColorStop(0, this.plugin.gradientStart);
            grad.addColorStop(1, this.plugin.gradientEnd);
            ctx.strokeStyle = grad;
          } else {
            ctx.strokeStyle = this.plugin.color;
          }
          ctx.stroke();
          ctx.closePath();
          // Increment the frame counter based on growthSpeed
          this.cntFrame += speed;
          return false;
        }
        return true;
      }
    };
    // Add the branch to the corresponding depth level
    this.branches[depth].push(branch);
    // Recursively create left and right sub-branches with adjusted angles
    this.createBranch(endX, endY, angle - this.random(15, 23), depth + 1);
    this.createBranch(endX, endY, angle + this.random(15, 23), depth + 1);
  };

  TreePlugin.prototype.animate = function () {
    // Clear the canvas for redrawing
    this.clearCanvas();

    // Draw already completed branches (from root up to currentDepth-1) fully
    for (var d = 0; d < this.currentDepth; d++) {
      if (d >= this.depth) break;
      for (var k = 0; k < this.branches[d].length; k++) {
        var branch = this.branches[d][k];
        this.ctx.beginPath();
        this.ctx.moveTo(branch.startX, branch.startY);
        this.ctx.lineTo(branch.endX, branch.endY);
        this.ctx.lineWidth = branch.lineWidth;
        if (this.colorMode === "gradient") {
          var grad = this.ctx.createLinearGradient(this.treeX, this.treeY, this.treeX, this.treeTop);
          grad.addColorStop(0, this.gradientStart);
          grad.addColorStop(1, this.gradientEnd);
          this.ctx.strokeStyle = grad;
        } else {
          this.ctx.strokeStyle = this.color;
        }
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }

    var stillGrowing = false;
    // Animate the branches at the current depth level
    if (this.currentDepth < this.depth) {
      var currentDone = true;
      for (var k = 0; k < this.branches[this.currentDepth].length; k++) {
        var branch = this.branches[this.currentDepth][k];
        if (branch.cntFrame < branch.frame) {
          branch.draw(this.ctx, this.growthSpeed);
          stillGrowing = true;
          currentDone = false;
        } else {
          // If the branch is fully drawn, draw it as a complete line
          this.ctx.beginPath();
          this.ctx.moveTo(branch.startX, branch.startY);
          this.ctx.lineTo(branch.endX, branch.endY);
          this.ctx.lineWidth = branch.lineWidth;
          if (this.colorMode === "gradient") {
            var grad = this.ctx.createLinearGradient(this.treeX, this.treeY, this.treeX, this.treeTop);
            grad.addColorStop(0, this.gradientStart);
            grad.addColorStop(1, this.gradientEnd);
            this.ctx.strokeStyle = grad;
          } else {
            this.ctx.strokeStyle = this.color;
          }
          this.ctx.stroke();
          this.ctx.closePath();
        }
      }
      // If all branches at the current depth are complete, move to the next depth level
      if (currentDone) {
        this.currentDepth++;
        stillGrowing = true;
      }
    }

    // Continue the animation if there are still branches growing
    if (stillGrowing) {
      this.animation = requestAnimationFrame(this.animate.bind(this));
    } else {
      cancelAnimationFrame(this.animation);
    }
  };

  // Expose TreePlugin globally
  window.TreePlugin = TreePlugin;
})();
