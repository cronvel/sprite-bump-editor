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



function Editor() {
	this.canvas = document.getElementById( "renderCanvas" ) ;	// Get the canvas element
	this.engine = new BABYLON.Engine( this.canvas , true ) ;	// Generate the Babylon 3D engine
	this.scene = new BABYLON.Scene( this.engine ) ;

	// Create camera and light
	this.camera = new BABYLON.ArcRotateCamera( "Camera" , - Math.PI / 2 , Math.PI / 2 , 8 , new BABYLON.Vector3( 0 , 0 , 0 ) , this.scene ) ;
	this.camera.attachControl( this.canvas , true ) ;

	// Second standing player
	this.sprite = null ;
	this.spriteMaterial = null ;

	this.lightMesh = BABYLON.MeshBuilder.CreateSphere( "lightMesh" , { diameter: 0.5 } , this.scene ) ;
	this.lightMesh.position = new BABYLON.Vector3( -3 , 2 , -2 ) ;
	this.lightMesh.material = new BABYLON.StandardMaterial( 'lightMeshMaterial' , this.scene ) ;
	this.lightMesh.material.diffuseColor = new BABYLON.Color3( 1 , 1 , 0 ) ;
	this.lightMesh.material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	//this.lightMesh.material.emissiveColor = new BABYLON.Color3( 0.5 , 0.4 , 0 ) ;
	this.lightMesh.isPickable = true ;
	//this.light = new BABYLON.PointLight( "PointLight" , this.lightMesh.position , this.scene ) ;
	this.light = new BABYLON.PointLight( "PointLight" , new BABYLON.Vector3( 0 , 0 , -2 ) , this.scene ) ;
	this.light.diffuse = new BABYLON.Color3( 1 , 1 , 1 ) ;
	this.light.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.light.intensity = 1 ;

	/*
	this.hemiLight = new BABYLON.HemisphericLight( "hemisphericLight" , new BABYLON.Vector3( 0 , 1 , 0 ) , this.scene ) ;
	this.hemiLight.diffuse = new BABYLON.Color3( 1 , 1 , 1 ) ;
	this.hemiLight.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.hemiLight.groundColor = new BABYLON.Color3( 0.2 , 0.2 , 0.2 ) ;
	this.hemiLight.intensity = 1 ;
	//*/
}



Editor.prototype.init = function() {
	// Register a render loop to repeatedly render the scene
	this.engine.runRenderLoop( () => {
		this.scene.render() ;
	} ) ;

	// Watch for browser/canvas resize events
	window.addEventListener( "resize" , () => {
		this.engine.resize() ;
	} ) ;
} ;



Editor.prototype.createSprite = function() {
	var material = new BABYLON.StandardMaterial( 'spriteMaterial' , this.scene ) ;
	material.backFaceCulling = true ;

	material.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;

	// Diffuse/Albedo
	var diffuseTexture = new BABYLON.Texture( "../textures/camoufleur.png" , this.scene ) ;
	material.diffuseTexture = diffuseTexture ;
	material.diffuseTexture.hasAlpha = true ;
	material.diffuseTexture.wrapU = material.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

	// Normal/Bump
	if ( false /* hasBump */ ) {
		let bumpTexture = new BABYLON.Texture( "../textures/camoufleur.normal.png" , this.scene ) ;
		material.bumpTexture = bumpTexture ;
		material.bumpTexture.wrapU = material.bumpTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

		// BABYLONJS use DirectX normalmap, but most software export OpenGL normalmap
		material.invertNormalMapX = true ;
		material.invertNormalMapY = true ;
	}

	// Specular
	if ( false /* hasSpecular */ ) {
		let specularTexture = new BABYLON.Texture( "sometexture" , this.scene ) ;
		material.specularTexture = specularTexture ;
		material.specularTexture.wrapU = material.specularTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;
		//material.specularPower = 1 ;
		material.useGlossinessFromSpecularMapAlpha = true ;
	}
	else {
		//material.specularPower = 0 ;	// This is the sharpness of the highlight
		material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	}

	// /!\ TEMP! Easier to debug!
	//material.backFaceCulling = false ;

	var mesh = BABYLON.Mesh.CreatePlane( 'sprite' , undefined , this.scene ) ;

	// Force billboard mode
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_X | BABYLON.AbstractMesh.BILLBOARDMODE_Y ;
	//mesh.rotation.y = Math.PI ;

	console.warn( 'Sprite Mesh:' , mesh ) ;
	mesh.material = material ;
	mesh.isPickable = true ;

	this.sprite = mesh ;
	this.spriteMaterial = material ;
} ;



async function run() {
	var editor = new Editor() ;
	editor.init() ;
	editor.createSprite() ;
}

run() ;

