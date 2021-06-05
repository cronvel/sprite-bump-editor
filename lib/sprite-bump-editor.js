/*
	Sprite Bump Editor

	Copyright (c) 2021 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const BABYLON = require( 'babylonjs' ) ;



// standard global variables
var scene , camera ;
var miniSpherePosition = new BABYLON.Vector3( 0 , 0 , 2 ) ;
var cube , gltfModel , babylonModel ;
var canvas = document.getElementById( "renderCanvas" ) ;	// Get the canvas element
var engine = new BABYLON.Engine( canvas , true ) ;	// Generate the Babylon 3D engine



async function createScene() {
	scene = new BABYLON.Scene(engine);
	scene.useRightHandedSystem = true ;

	// Create camera and light
	//var light = new BABYLON.PointLight("Point", new BABYLON.Vector3(5, 10, 5), scene);
	camera = new BABYLON.ArcRotateCamera("Camera", 1, 0.8, 8, new BABYLON.Vector3(0, 0, 0), scene);

	camera.attachControl(canvas, true);

	//Create a manager for the player's sprite animation
	var spriteManagerPlayer = new BABYLON.SpriteManager("playerManager", "../textures/camoufleur.png", 1, 700, scene);

	// Second standing player
	var player2 = new BABYLON.Sprite("player2", spriteManagerPlayer);
	player2.stopAnimation(); // Not animated
	player2.cellIndex = 0;
	player2.position.y = 0;
	player2.position.x = 1;
	player2.size = 3;
	//player2.invertU = -1; //Change orientation
	player2.isPickable = true;
	
    var miniSphere = BABYLON.MeshBuilder.CreateSphere( "miniSphere" , { diameter: 0.5 } , scene ) ;
    miniSphere.position = miniSpherePosition ;
    miniSphere.material = new BABYLON.StandardMaterial( 'miniSphereMaterial' , scene ) ;
    miniSphere.material.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
    miniSphere.material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
    miniSphere.material.emissiveColor = new BABYLON.Color3( 0.5 , 0.4 , 0 ) ;

	return scene;
}



async function run() {
	await createScene() ;

	// Register a render loop to repeatedly render the scene
	engine.runRenderLoop( () => {
		scene.render() ;
	} ) ;

	// Watch for browser/canvas resize events
	window.addEventListener( "resize" , () => {
		engine.resize() ;
	} ) ;
}

run() ;

