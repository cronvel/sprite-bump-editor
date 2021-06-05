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
BABYLON.GUI = require( 'babylonjs-gui' ) ;

const string = require( 'string-kit' ) ;



function Editor() {
	this.canvas = document.getElementById( "renderCanvas" ) ;	// Get the canvas element
	this.engine = new BABYLON.Engine( this.canvas , true ) ;	// Generate the Babylon 3D engine
	this.scene = new BABYLON.Scene( this.engine ) ;
	this.scene.ambientColor = new BABYLON.Color3( 0.1 , 0.1 , 0.1 ) ;

	// Create camera and light
	this.camera = new BABYLON.ArcRotateCamera( "Camera" , -Math.PI / 2 , Math.PI / 2 , 5 , new BABYLON.Vector3( 0 , 0 , 0 ) , this.scene ) ;
	this.camera.attachControl( this.canvas , true ) ;
	this.camera.wheelPrecision = 25 ;

	// Second standing player
	this.sprite = null ;

	this.light = new BABYLON.PointLight( "PointLight" , new BABYLON.Vector3( -1 , 1 , -2 ) , this.scene ) ;
	this.light.diffuse = new BABYLON.Color3( 1 , 1 , 1 ) ;
	this.light.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.light.intensity = 1 ;
	this.lightMesh = BABYLON.MeshBuilder.CreateSphere( "lightMesh" , { diameter: 0.1 } , this.scene ) ;
	this.lightMesh.position = this.light.position ;
	this.lightMesh.material = new BABYLON.StandardMaterial( 'lightMeshMaterial' , this.scene ) ;
	this.lightMesh.material.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.lightMesh.material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.lightMesh.material.emissiveColor = this.light.diffuse ;
	this.lightMesh.isPickable = true ;

	/*
	this.hemiLight = new BABYLON.HemisphericLight( "hemisphericLight" , new BABYLON.Vector3( 0 , 1 , 0 ) , this.scene ) ;
	this.hemiLight.diffuse = new BABYLON.Color3( 1 , 1 , 1 ) ;
	this.hemiLight.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	this.hemiLight.groundColor = new BABYLON.Color3( 0.2 , 0.2 , 0.2 ) ;
	this.hemiLight.intensity = 1 ;
	//*/

	this.panel = null ;
	this.controls = {} ;
}

module.exports = Editor ;



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
	if ( true /* hasBump */ ) {
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

	mesh.material = material ;
	//mesh.isPickable = true ;

	this.scaleMeshRatioFromTexture( mesh ) ;

	this.sprite = mesh ;
} ;



Editor.prototype.scaleMeshRatioFromTexture = function( mesh ) {
	var size ,
		pixelDensity = 200 ,
		texture = mesh.material.diffuseTexture ;

	if ( texture.isReady() ) {
		size = texture.getBaseSize() ;
		mesh.scaling.x = size.width / pixelDensity ;
		mesh.scaling.y = size.height / pixelDensity ;
	}
	else {
		BABYLON.Texture.WhenAllReady( [ texture ] , () => {
			size = texture.getBaseSize() ;
			mesh.scaling.x = size.width / pixelDensity ;
			mesh.scaling.y = size.height / pixelDensity ;
		} ) ;
	}
} ;



Editor.prototype.initPanel = function() {
	var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI( 'UI' ) ;

	this.panel = new BABYLON.GUI.StackPanel() ;
	this.panel.width = "220px" ;
	this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT ;
	this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER ;
	advancedTexture.addControl( this.panel ) ;

	this.addSliderControl( 'ambient' , 0 , 1 , this.scene.ambientColor.r , ( control , value ) => {
		control.header.text = string.format( "Ambient intensity: %i%%" , 100 * value ) ;
		this.scene.ambientColor.r = value ;
		this.scene.ambientColor.g = value ;
		this.scene.ambientColor.b = value ;
	} ) ;

	this.addSliderControl( 'lightIntensity' , 0 , 4 , this.light.intensity , ( control , value ) => {
		control.header.text = string.format( "Light intensity: %[.2]f" , value ) ;
		this.light.intensity = value ;
	} ) ;

	this.addSliderControl( 'lightRed' , 0 , 1 , this.light.diffuse.r , ( control , value ) => {
		control.header.text = string.format( "Light red: %i%%" , 100 * value ) ;
		this.light.diffuse.r = value ;
	} ) ;

	this.addSliderControl( 'lightGreen' , 0 , 1 , this.light.diffuse.g , ( control , value ) => {
		control.header.text = string.format( "Light green: %i%%" , 100 * value ) ;
		this.light.diffuse.g = value ;
	} ) ;

	this.addSliderControl( 'lightBlue' , 0 , 1 , this.light.diffuse.b , ( control , value ) => {
		control.header.text = string.format( "Light blue: %i%%" , 100 * value ) ;
		this.light.diffuse.b = value ;
	} ) ;
} ;



Editor.prototype.addSliderControl = function( name , min , max , initial , updateFn ) {
	var header = new BABYLON.GUI.TextBlock() ;
	header.height = "30px" ;
	header.color = "white" ;
	this.panel.addControl( header ) ;

	var slider = new BABYLON.GUI.Slider() ;
	slider.minimum = min ;
	slider.maximum = max ;
	slider.value = initial ;
	slider.height = "20px" ;
	slider.width = "200px" ;
	this.panel.addControl( slider ) ;

	var control = this.controls[ name ] = { header , slider } ;
	slider.onValueChangedObservable.add( value => updateFn( control , value ) ) ;
	updateFn( control , slider.value ) ;
} ;



Editor.prototype.movePickable = function() {
	var currentMesh , moving = false ;

	var pickingScreen = BABYLON.Mesh.CreatePlane( 'pickingScreen' , 10 , this.scene ) ;
	pickingScreen.position.z = -100 ;
	pickingScreen.visibility = false ;

	var getPickingScreenPosition = () => {
		var pickinfo = this.scene.pick( this.scene.pointerX , this.scene.pointerY , mesh => mesh === pickingScreen ) ;
		if ( pickinfo.hit ) { return pickinfo.pickedPoint ; }
		return null ;
	} ;

	var pointerDown = mesh => {
		currentMesh = mesh ;
		pickingScreen.position.z = currentMesh.position.z ;
		moving = true ;
			this.camera.detachControl( this.canvas ) ;
		setTimeout( () => {
		} , 0 ) ;
	} ;

	var pointerUp = () => {
		if ( ! moving ) { return ; }
		pickingScreen.position.z = -100 ;
		this.camera.attachControl( this.canvas , true ) ;
		moving = false ;
	} ;

	var pointerMove = () => {
		if ( ! moving ) { return ; }
		var current = getPickingScreenPosition() ;
		currentMesh.position.x = current.x ;
		currentMesh.position.y = current.y ;
	} ;

	var pointerWheel = delta => {
		if ( ! moving ) { return ; }
		currentMesh.position.z += delta ;
		pickingScreen.position.z = currentMesh.position.z ;
	} ;

	this.scene.onPointerObservable.add( ( pointerInfo ) => {
		switch ( pointerInfo.type ) {
			case BABYLON.PointerEventTypes.POINTERDOWN :
				if ( pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh !== pickingScreen ) {
					pointerDown( pointerInfo.pickInfo.pickedMesh ) ;
				}
				break ;
			case BABYLON.PointerEventTypes.POINTERUP :
				pointerUp() ;
				break ;
			case BABYLON.PointerEventTypes.POINTERMOVE :
				pointerMove() ;
				break ;
			case BABYLON.PointerEventTypes.POINTERWHEEL :
				pointerWheel( Math.sign( pointerInfo.event.deltaY ) ) ;
				break;
		}
	} ) ;
} ;

