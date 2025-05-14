// js/game.js
// This is the core Tower Blocks game logic using Three.js and GSAP.
// It does NOT include Supabase interactions directly.
// Supabase interactions will be handled in the <script> block of game.html or a separate js/game-integration.js

console.log("game.js: Core game logic loaded.");

// Ensure THREE and TweenLite/Power1 are available (loaded from CDN in game.html)
if (typeof THREE === 'undefined') {
    console.error("game.js: THREE.js is not loaded. Game cannot start.");
    alert("Error: Game library THREE.js not found!");
}
if (typeof TweenLite === 'undefined' || typeof Power1 === 'undefined') {
    console.error("game.js: GSAP (TweenLite/Power1) is not loaded. Game animations will fail.");
    alert("Error: Animation library GSAP not found!");
}

var Stage = /** @class */ (function () {
    function Stage() {
        var _this = this;
        this.render = function () {
            this.renderer.render(this.scene, this.camera);
        };
        this.add = function (elem) {
            this.scene.add(elem);
        };
        this.remove = function (elem) {
            this.scene.remove(elem);
        };
        // container
        this.container = document.getElementById('game'); // Game canvas container
        if (!this.container) {
            console.error("game.js: Game container element with id 'game' not found.");
            return;
        }

        // renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false // Set to false for opaque background, true for transparent
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xD0CBC7, 1); // Original background color
        this.container.appendChild(this.renderer.domElement);

        // scene
        this.scene = new THREE.Scene();

        // camera
        var aspect = window.innerWidth / window.innerHeight;
        var d = 20; // view distance
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -100, 1000);
        this.camera.position.set(2, 2, 2); // Initial camera position
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        // light
        this.light = new THREE.DirectionalLight(0xffffff, 0.5);
        this.light.position.set(0, 499, 0);
        this.scene.add(this.light);

        this.softLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.softLight);

        window.addEventListener('resize', function () { return _this.onResize(); });
        this.onResize(); // Call initial resize
    }
    Stage.prototype.setCamera = function (y, speed) {
        if (speed === void 0) { speed = 0.3; }
        if (this.camera && typeof TweenLite !== 'undefined') {
            TweenLite.to(this.camera.position, speed, { y: y + 4, ease: Power1.easeInOut });
            // lookAt target should also be animated if the camera moves significantly,
            // but for this game, focusing on y for the blocks is primary.
            // The original lookAt was (0,0,0) but y changes, so it should follow.
            TweenLite.to(this.camera.lookAt, speed, { y: y, ease: Power1.easeInOut });
        }
    };
    Stage.prototype.onResize = function () {
        if (!this.renderer || !this.camera) return;
        var viewSize = 30; // This was in the original code, relates to camera projection scaling
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Orthographic camera updates based on window size
        this.camera.left = window.innerWidth / -viewSize;
        this.camera.right = window.innerWidth / viewSize;
        this.camera.top = window.innerHeight / viewSize;
        this.camera.bottom = window.innerHeight / -viewSize;
        this.camera.updateProjectionMatrix();
    };
    return Stage;
}());

var Block = /** @class */ (function () {
    function Block(block) {
        this.STATES = { ACTIVE: 'active', STOPPED: 'stopped', MISSED: 'missed' };
        this.MOVE_AMOUNT = 12; // How far the block moves side to side

        this.dimension = { width: 0, height: 0, depth: 0 };
        this.position = { x: 0, y: 0, z: 0 };
        
        this.targetBlock = block; // The block below, or null for the first block
        this.index = (this.targetBlock ? this.targetBlock.index : 0) + 1;
        
        this.workingPlane = this.index % 2 ? 'x' : 'z'; // Alternates between x and z axes
        this.workingDimension = this.index % 2 ? 'width' : 'depth'; // Dimension corresponding to the working plane

        // Set dimensions from target block or defaults
        this.dimension.width = this.targetBlock ? this.targetBlock.dimension.width : 10;
        this.dimension.height = this.targetBlock ? this.targetBlock.dimension.height : 2; // All blocks have same height
        this.dimension.depth = this.targetBlock ? this.targetBlock.dimension.depth : 10;

        this.position.x = this.targetBlock ? this.targetBlock.position.x : 0;
        this.position.y = this.dimension.height * this.index; // Stack blocks vertically
        this.position.z = this.targetBlock ? this.targetBlock.position.z : 0;

        this.colorOffset = this.targetBlock ? this.targetBlock.colorOffset : Math.round(Math.random() * 100);

        // Set color
        if (!this.targetBlock) {
            this.color = 0x333344; // Base block color
        } else {
            var offset = this.index + this.colorOffset;
            var r = Math.sin(0.3 * offset) * 55 + 200;
            var g = Math.sin(0.3 * offset + 2) * 55 + 200;
            var b = Math.sin(0.3 * offset + 4) * 55 + 200;
            this.color = new THREE.Color(r / 255, g / 255, b / 255);
        }

        this.state = this.index > 1 ? this.STATES.ACTIVE : this.STATES.STOPPED; // First block is stopped, others active

        // Set speed and direction
        this.speed = -0.1 - (this.index * 0.005); // Game gets faster
        if (this.speed < -4) this.speed = -4; // Max speed
        this.direction = this.speed;

        // Create block
        var geometry = new THREE.BoxGeometry(this.dimension.width, this.dimension.height, this.dimension.depth);
        // Shift the geometry so its corner is at (0,0,0) then position the mesh
        geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(this.dimension.width / 2, this.dimension.height / 2, this.dimension.depth / 2));
        
        this.material = new THREE.MeshToonMaterial({ color: this.color }); // Using ToonMaterial for a flatter look
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);

        if (this.state === this.STATES.ACTIVE) {
            // Start active blocks off-center
            this.position[this.workingPlane] = Math.random() > 0.5 ? -this.MOVE_AMOUNT : this.MOVE_AMOUNT;
            this.mesh.position[this.workingPlane] = this.position[this.workingPlane];
        }
    }
    Block.prototype.reverseDirection = function () {
        this.direction = this.direction > 0 ? this.speed : Math.abs(this.speed);
    };
    Block.prototype.place = function () {
        this.state = this.STATES.STOPPED;

        var overlap = this.targetBlock.dimension[this.workingDimension] - Math.abs(this.position[this.workingPlane] - this.targetBlock.position[this.workingPlane]);
        
        var blocksToReturn = {
            plane: this.workingPlane,
            direction: this.direction,
            placed: null, // The part of the block that is successfully placed
            chopped: null, // The part of the block that is cut off
            bonus: false
        };

        if (this.dimension[this.workingDimension] - overlap < 0.3) { // Perfect placement (within tolerance)
            overlap = this.dimension[this.workingDimension];
            blocksToReturn.bonus = true;
            // Align perfectly with the target block
            this.position.x = this.targetBlock.position.x;
            this.position.z = this.targetBlock.position.z;
            this.dimension.width = this.targetBlock.dimension.width;
            this.dimension.depth = this.targetBlock.dimension.depth;
        }

        if (overlap > 0) {
            var choppedDimensions = { 
                width: this.dimension.width, 
                height: this.dimension.height, 
                depth: this.dimension.depth 
            };
            choppedDimensions[this.workingDimension] -= overlap; // Size of the chopped piece
            
            this.dimension[this.workingDimension] = overlap; // New size of the placed piece

            // Create placed mesh
            var placedGeometry = new THREE.BoxGeometry(this.dimension.width, this.dimension.height, this.dimension.depth);
            placedGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(this.dimension.width / 2, this.dimension.height / 2, this.dimension.depth / 2));
            var placedMesh = new THREE.Mesh(placedGeometry, this.material);
            placedMesh.position.set(this.position.x, this.position.y, this.position.z); // Initial position of current block before alignment

            // Adjust position of the placed part to align correctly
            if (this.position[this.workingPlane] < this.targetBlock.position[this.workingPlane]) {
                this.position[this.workingPlane] = this.targetBlock.position[this.workingPlane];
            }
            // The placed mesh should be positioned based on this.position AFTER alignment
            placedMesh.position[this.workingPlane] = this.position[this.workingPlane];


            blocksToReturn.placed = placedMesh;

            // Create chopped mesh if not a bonus (perfect) placement
            if (!blocksToReturn.bonus) {
                var choppedGeometry = new THREE.BoxGeometry(choppedDimensions.width, choppedDimensions.height, choppedDimensions.depth);
                choppedGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(choppedDimensions.width / 2, choppedDimensions.height / 2, choppedDimensions.depth / 2));
                var choppedMesh = new THREE.Mesh(choppedGeometry, this.material);
                
                var choppedPosition = { x: this.position.x, y: this.position.y, z: this.position.z };
                // Position the chopped piece correctly next to the placed piece
                if (this.position[this.workingPlane] < this.targetBlock.position[this.workingPlane]) {
                    // Chopped piece is to the "left" (negative direction) of the target's edge
                    choppedPosition[this.workingPlane] = this.position[this.workingPlane] - choppedDimensions[this.workingDimension]; // This was original logic
                } else {
                    // Chopped piece is to the "right" (positive direction)
                    choppedPosition[this.workingPlane] = this.position[this.workingPlane] + this.dimension[this.workingDimension]; // Placed part + its own dimension
                }
                 // Correction: The initial this.position is where the *original full block* was centered during placement attempt.
                // The logic here needs to ensure the chopped piece is at the correct side of the *original* block's placement.
                if (placedMesh.position[this.workingPlane] > this.targetBlock.position[this.workingPlane]) { // Placed part is to the right
                    choppedPosition[this.workingPlane] = placedMesh.position[this.workingPlane] + this.dimension[this.workingDimension];
                } else { // Placed part is to the left
                    choppedPosition[this.workingPlane] = placedMesh.position[this.workingPlane] - choppedDimensions[this.workingDimension];
                }


                choppedMesh.position.set(choppedPosition.x, choppedPosition.y, choppedPosition.z);
                blocksToReturn.chopped = choppedMesh;
            }
        } else { // No overlap, missed
            this.state = this.STATES.MISSED;
        }
        // this.dimension[this.workingDimension] = overlap; // Already set above
        return blocksToReturn;
    };
    Block.prototype.tick = function () {
        if (this.state === this.STATES.ACTIVE && this.mesh) {
            var value = this.position[this.workingPlane];
            if (value > this.MOVE_AMOUNT || value < -this.MOVE_AMOUNT) {
                this.reverseDirection();
            }
            this.position[this.workingPlane] += this.direction;
            this.mesh.position[this.workingPlane] = this.position[this.workingPlane];
        }
    };
    return Block;
}());

var Game = /** @class */ (function () {
    function Game() {
        var _this = this;
        this.STATES = {
            LOADING: 'loading',
            PLAYING: 'playing',
            READY: 'ready',
            ENDED: 'ended',
            RESETTING: 'resetting'
        };
        this.blocks = []; // Array to hold Block instances
        this.state = this.STATES.LOADING;

        // DOM Elements
        this.mainContainer = document.getElementById('container');
        this.scoreContainer = document.getElementById('score');
        // startButton is part of game-ready, handled by onAction
        this.instructions = document.getElementById('instructions');

        if (!this.mainContainer || !this.scoreContainer || !this.instructions) {
            console.error("game.js: Essential DOM elements for game (container, score, instructions) not found.");
            return;
        }
        
        this.stage = new Stage(); // Initialize Three.js stage
        if (!this.stage || !this.stage.renderer) { // Check if Stage was initialized
            console.error("game.js: Stage initialization failed. Game cannot continue.");
            return;
        }


        this.scoreContainer.innerHTML = '0';

        // THREE.js Groups for managing meshes
        this.newBlocks = new THREE.Group(); // Holds the currently active (moving) block
        this.placedBlocks = new THREE.Group(); // Holds successfully placed blocks
        this.choppedBlocks = new THREE.Group(); // Holds chopped pieces

        this.stage.add(this.newBlocks);
        this.stage.add(this.placedBlocks);
        this.stage.add(this.choppedBlocks);

        this.addBlock(); // Add the initial base block
        this.tick(); // Start the game loop

        this.updateState(this.STATES.READY); // Set game to ready state

        // Event Listeners
        document.addEventListener('keydown', function (e) { if (e.key === ' ' || e.code === 'Space') _this.onAction(); }); // Spacebar
        this.mainContainer.addEventListener('click', function () { return _this.onAction(); }); // Click
        // Touch event might still cause double trigger on some devices if not handled carefully
        // For simplicity, focusing on click and keydown for now.
        // document.addEventListener('touchstart', function (e) { e.preventDefault(); _this.onAction(); });
    }
    Game.prototype.updateState = function (newState) {
        // Remove all state classes
        for (var key in this.STATES) {
            if (this.mainContainer.classList.contains(this.STATES[key])) {
                this.mainContainer.classList.remove(this.STATES[key]);
            }
        }
        // Add the new state class
        this.mainContainer.classList.add(newState);
        this.state = newState;
    };
    Game.prototype.onAction = function () {
        switch (this.state) {
            case this.STATES.READY:
                this.startGame();
                break;
            case this.STATES.PLAYING:
                this.placeBlock();
                break;
            case this.STATES.ENDED:
                this.restartGame();
                break;
            // No action for LOADING or RESETTING states
        }
    };
    Game.prototype.startGame = function () {
        if (this.state !== this.STATES.PLAYING) {
            this.scoreContainer.innerHTML = '0';
            this.updateState(this.STATES.PLAYING);
            this.addBlock(); // Add the first moving block
            if (this.instructions) this.instructions.classList.remove('hide');
        }
    };
    Game.prototype.restartGame = function () {
        var _this = this;
        this.updateState(this.STATES.RESETTING);

        // Clear old blocks with animation
        var oldBlocks = this.placedBlocks.children;
        var removeSpeed = 0.2;
        var delayAmount = 0.02;

        for (var i = 0; i < oldBlocks.length; i++) {
            if (typeof TweenLite !== 'undefined') {
                TweenLite.to(oldBlocks[i].scale, removeSpeed, {
                    x: 0, y: 0, z: 0,
                    delay: (oldBlocks.length - i) * delayAmount,
                    ease: Power1.easeIn,
                    onCompleteParams: [oldBlocks[i]], // Pass the block to onComplete
                    onComplete: function(blockToRemove) { // blockToRemove is the param passed
                        if (_this.placedBlocks && blockToRemove) _this.placedBlocks.remove(blockToRemove);
                    }
                });
                TweenLite.to(oldBlocks[i].rotation, removeSpeed, {
                    y: 0.5, // A slight rotation as it disappears
                    delay: (oldBlocks.length - i) * delayAmount,
                    ease: Power1.easeIn
                });
            } else { // Fallback if GSAP not loaded
                 if (_this.placedBlocks && oldBlocks[i]) _this.placedBlocks.remove(oldBlocks[i]);
            }
        }
        
        // Also clear any falling chopped blocks
        var oldChopped = this.choppedBlocks.children;
        for (var k = 0; k < oldChopped.length; k++) {
            if (this.choppedBlocks && oldChopped[k]) this.choppedBlocks.remove(oldChopped[k]);
        }


        var cameraMoveSpeed = removeSpeed * 2 + oldBlocks.length * delayAmount;
        this.stage.setCamera(2, cameraMoveSpeed); // Reset camera to initial height

        // Animate score countdown (optional, can be removed if too complex without GSAP for values)
        if (typeof TweenLite !== 'undefined') {
            var countdown = { value: this.blocks.length -1 }; // Current score
            TweenLite.to(countdown, cameraMoveSpeed, {
                value: 0,
                onUpdate: function () { _this.scoreContainer.innerHTML = String(Math.round(countdown.value)); }
            });
        }


        // Reset blocks array to just the base block
        this.blocks = this.blocks.slice(0, 1); 
        if (this.blocks.length > 0) { // Ensure base block mesh is reset if it was scaled
            this.blocks[0].mesh.scale.set(1,1,1);
        }


        // Timeout to start new game after animations
        setTimeout(function () {
            // If the base block was removed due to onComplete logic, re-add it
            if (_this.placedBlocks.children.length === 0 && _this.blocks.length > 0) {
                 // Recreate or re-add the base block's mesh if necessary
                 // For simplicity, let's assume the base block (blocks[0]) mesh is still valid
                 // or addBlock will handle creating it if blocks array is empty.
                 // The critical part is that placedBlocks should be empty before starting.
            }
            _this.startGame();
        }, cameraMoveSpeed * 1000 + 100); // Add a small buffer
    };
    Game.prototype.placeBlock = function () {
        var _this = this;
        var currentBlock = this.blocks[this.blocks.length - 1];
        var newBlocksData = currentBlock.place(); // This method returns placed, chopped, etc.

        // Remove the visual representation of the full, moving block
        this.newBlocks.remove(currentBlock.mesh);

        if (newBlocksData.placed) {
            this.placedBlocks.add(newBlocksData.placed);
        }

        if (newBlocksData.chopped) {
            this.choppedBlocks.add(newBlocksData.chopped);
            var positionParams = {
                y: '-=30', // Fall down
                ease: Power1.easeIn,
                onCompleteParams: [newBlocksData.chopped],
                onComplete: function(blockToRemove) {
                    if (_this.choppedBlocks && blockToRemove) _this.choppedBlocks.remove(blockToRemove);
                }
            };
            var rotateRandomness = 10;
            var rotationParams = {
                delay: 0.05,
                x: newBlocksData.plane === 'z' ? (Math.random() * rotateRandomness - rotateRandomness / 2) : 0.1,
                z: newBlocksData.plane === 'x' ? (Math.random() * rotateRandomness - rotateRandomness / 2) : 0.1,
                y: Math.random() * 0.1
            };

            // Make chopped block fly off to the side
            var flyOffAmount = 40; // How far it flies off
            if (newBlocksData.chopped.position[newBlocksData.plane] > newBlocksData.placed.position[newBlocksData.plane]) {
                 positionParams[newBlocksData.plane] = `+=${flyOffAmount * Math.abs(newBlocksData.direction)}`;
            } else {
                 positionParams[newBlocksData.plane] = `-=${flyOffAmount * Math.abs(newBlocksData.direction)}`;
            }
            if (typeof TweenLite !== 'undefined') {
                TweenLite.to(newBlocksData.chopped.position, 1, positionParams);
                TweenLite.to(newBlocksData.chopped.rotation, 1, rotationParams);
            } else { // Fallback if GSAP not loaded
                if (this.choppedBlocks && newBlocksData.chopped) this.choppedBlocks.remove(newBlocksData.chopped);
            }
        }

        if (currentBlock.state === currentBlock.STATES.MISSED) {
            this.endGame();
        } else {
            this.addBlock(); // Add the next block
        }
    };
    Game.prototype.addBlock = function () {
        var lastBlock = this.blocks[this.blocks.length - 1];
        
        // Game over condition handled by placeBlock after checking currentBlock.state
        // if (lastBlock && lastBlock.state === lastBlock.STATES.MISSED) {
        //     return this.endGame();
        // }

        this.scoreContainer.innerHTML = String(this.blocks.length -1); // Score is number of placed blocks above base

        var newKidOnTheBlock = new Block(lastBlock); // Create new Block instance
        if (newKidOnTheBlock.mesh) {
            this.newBlocks.add(newKidOnTheBlock.mesh); // Add its mesh to the scene via newBlocks group
            this.blocks.push(newKidOnTheBlock); // Add instance to our array

            this.stage.setCamera(this.blocks.length * 2); // Adjust camera height
        } else {
            console.error("game.js: Failed to create mesh for new block. Game might be stuck.");
            // this.endGame(); // Potentially end game if block creation fails
        }


        if (this.blocks.length >= 5 && this.instructions) {
            this.instructions.classList.add('hide');
        }
    };
    Game.prototype.endGame = function () {
        // This is the original endGame. Supabase interactions (score update, rank display)
        // will be triggered by the override in game.html's script.
        this.updateState(this.STATES.ENDED);
        console.log("game.js: Original Game.prototype.endGame called. State set to ENDED.");
        // The game over message text is handled by the Supabase integration part.
    };
    Game.prototype.tick = function () {
        var _this = this;
        if (this.blocks.length > 0) {
             this.blocks[this.blocks.length - 1].tick(); // Update the current (topmost) block
        }
        if (this.stage) this.stage.render(); // Render the scene
        requestAnimationFrame(function () { _this.tick(); }); // Loop
    };
    return Game;
}());

// Initialize the game when the script is loaded and DOM is somewhat ready.
// The Game constructor itself checks for essential DOM elements.
// We'll instantiate it after ensuring the DOM is ready in game.html's final script block.
// var game = new Game(); // This line will be moved to game.html's script