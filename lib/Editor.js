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

const CanvasEditor = require( './CanvasEditor.js' ) ;
const helpers = require( './helpers.js' ) ;

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

	this.sprite = null ;
	this.spriteAlbedo = null ;

	this.normalDynamicTexture = null ;
	this.normalCanvasEditor = null ;
	this.textureCanvasOverlay = null ;
	this.overlayDynamicTexture = null ;

	this.textureCanvas = null ;
	this.overlayCanvasEditor = null ;

	this.normalSphere = null ;

	this.lights = [] ;

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

	this.addLight( new BABYLON.Vector3( -1 , 1 , -2 ) , new BABYLON.Color3( 1 , 1 , 1 ) , 0.6 ) ;
	this.addLight( new BABYLON.Vector3( -0.7 , 0.5 , -2 ) , new BABYLON.Color3( 1 , 1 , 0.5 ) , 0.4 ) ;
	this.createSprite() ;
	this.createTextureCanvas() ;
	this.createNormalDynamicTexture() ;
	this.createNormalSphere() ;
	this.initPanel() ;
	this.manageViewInputs() ;
} ;



Editor.prototype.addLight = function( position = null , color = null , intensity = 0.5 ) {
	var light = new BABYLON.PointLight( "PointLight" , position || new BABYLON.Vector3( -1 , 1 , -2 ) , this.scene ) ,
		mesh = BABYLON.MeshBuilder.CreateSphere( "lightMesh" , { diameter: 0.1 } , this.scene ) ,
		item = { light , mesh } ;

	this.lights.push( item ) ;

	light.diffuse = color || new BABYLON.Color3( 1 , 1 , 1 ) ;
	light.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	light.intensity = intensity ;

	mesh.position = light.position ;
	mesh.material = new BABYLON.StandardMaterial( 'lightMeshMaterial' , this.scene ) ;
	mesh.material.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	mesh.material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	mesh.material.emissiveColor = light.diffuse ;
	mesh.isPickable = true ;
	mesh.__movable__ = true ;
} ;



Editor.prototype.createSprite = function() {
	var material = new BABYLON.StandardMaterial( 'spriteMaterial' , this.scene ) ;
	material.backFaceCulling = true ;

	material.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;

	// Diffuse/Albedo
	this.spriteAlbedo = new BABYLON.Texture( "../textures/camoufleur.png" , this.scene ) ;
	material.diffuseTexture = this.spriteAlbedo ;
	material.diffuseTexture.hasAlpha = true ;
	material.diffuseTexture.wrapU = material.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

	//material.specularPower = 0 ;	// This is the sharpness of the highlight
	material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;

	// /!\ TEMP! Easier to debug!
	//material.backFaceCulling = false ;

	var mesh = BABYLON.Mesh.CreatePlane( 'sprite' , undefined , this.scene ) ;

	// Force billboard mode
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_X | BABYLON.AbstractMesh.BILLBOARDMODE_Y ;

	mesh.material = material ;
	mesh.isPickable = false ;

	this.scaleMeshRatioFromTexture( mesh ) ;

	this.sprite = mesh ;
} ;



Editor.prototype.createNormalSphere = function() {
	var material = new BABYLON.StandardMaterial( 'spriteMaterial' , this.scene ) ;
	material.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.backFaceCulling = true ;

	var mesh = BABYLON.MeshBuilder.CreateSphere( "normalSphere" , { diameter: 2 } , this.scene ) ;
	mesh.material = material ;
	mesh.visibility = false ;
	mesh.isPickable = true ;

	this.normalSphere = mesh ;
} ;



Editor.prototype.scaleMeshRatioFromTexture = function( mesh ) {
	var size ,
		pixelDensity = 200 ,
		texture = mesh.material.diffuseTexture ;

	if ( ! texture.isReady() ) {
		BABYLON.Texture.WhenAllReady( [ texture ] , () => this.scaleMeshRatioFromTexture( mesh ) ) ;
		return ;
	}

	size = texture.getBaseSize() ;
	mesh.scaling.x = size.width / pixelDensity ;
	mesh.scaling.y = size.height / pixelDensity ;
} ;



Editor.prototype.createTextureCanvas = function() {
	var material = new BABYLON.StandardMaterial( 'canvasMaterial' , this.scene ) ;
	material.backFaceCulling = true ;

	material.ambientColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	//material.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh = BABYLON.Mesh.CreatePlane( 'sprite' , 1 , this.scene ) ;

	mesh.material = material ;
	mesh.position.x = -3 ;
	mesh.isPickable = true ;

	this.textureCanvas = mesh ;


	// Overlay
	
	var material2 = new BABYLON.StandardMaterial( 'canvasMaterial' , this.scene ) ;
	material2.backFaceCulling = true ;

	material2.ambientColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material2.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material2.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material2.useAlphaFromDiffuseTexture = true ;
	
	// https://forum.babylonjs.com/t/dynamic-texture-clear-background/17319/12
	// https://playground.babylonjs.com/#5ZCGRM#980
	
	//material2.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh2 = BABYLON.Mesh.CreatePlane( 'sprite' , 1 , this.scene ) ;

	mesh2.material = material2 ;
	mesh2.position.x = -3 ;
	mesh2.position.z = -0.01 ;
	mesh2.isPickable = false ;

	this.textureCanvasOverlay = mesh2 ;
} ;



Editor.prototype.createNormalDynamicTexture = function() {
	var image = new Image() ;
	image.src = "../textures/camoufleur.normal.png" ;

	image.onload = () => {
		// Create dynamic texture
		var size = { width: image.naturalWidth , height: image.naturalHeight } ;
		var dynamicTexture  = this.normalDynamicTexture = new BABYLON.DynamicTexture( 'normalDynamicTexture' , size , this.scene ) ;
		var overlayTexture = this.overlayDynamicTexture = new BABYLON.DynamicTexture( 'overlayDynamicTexture' , size , this.scene ) ;
		overlayTexture.hasAlpha = true ;
		dynamicTexture.wrapU = dynamicTexture.wrapV = overlayTexture.wrapU = overlayTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

		// Add image to dynamic texture
		var textureContext = this.normalDynamicTexture.getContext() ;
		this.normalCanvasEditor = new CanvasEditor( textureContext , overlayTexture.getContext() , size ) ;
		this.normalCanvasEditor.setImage( image ) ;
		dynamicTexture.update() ;
		overlayTexture.update() ;

		var material = this.sprite.material ;
		material.bumpTexture = dynamicTexture ;

		// BABYLONJS use DirectX normalmap, but most software export OpenGL normalmap
		material.invertNormalMapX = true ;
		material.invertNormalMapY = true ;

		this.setTextureOfTextureCanvas( dynamicTexture , overlayTexture , size ) ;
	} ;
} ;



Editor.prototype.setTextureOfTextureCanvas = function( dynamicTexture , overlayDynamicTexture , size ) {
	var pixelDensity = 200 ;

	var material = this.textureCanvas.material ;
	material.emissiveTexture = dynamicTexture ;

	var mesh  = this.textureCanvas ;
	mesh.scaling.x = size.width / pixelDensity ;
	mesh.scaling.y = size.height / pixelDensity ;
	

	// Overlay
	
	var material2 = this.textureCanvasOverlay.material ;
	material2.emissiveTexture = overlayDynamicTexture ;

	var mesh2  = this.textureCanvasOverlay ;
	mesh2.scaling.x = size.width / pixelDensity ;
	mesh2.scaling.y = size.height / pixelDensity ;
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

	this.lights.forEach( ( lightItem , index ) => this.addLightControls( lightItem , index ) ) ;

	this.addSliderControl( 'opacity' , 0 , 1 , 1 , ( control , value ) => {
		control.header.text = string.format( "Draw opacity: %i%%" , 100 * value ) ;
		if ( this.normalCanvasEditor ) { this.normalCanvasEditor.setOpacity( value ) ; }
	} ) ;
} ;



Editor.prototype.addLightControls = function( lightItem , index ) {
	this.addSliderControl( 'lightIntensity' + index , 0 , 2 , lightItem.light.intensity , ( control , value ) => {
		control.header.text = string.format( "Light #%i intensity: %[.2]f" , index + 1 , value ) ;
		lightItem.light.intensity = value ;
	} ) ;

	this.addColorPickerControl( 'lightColor' + index , lightItem.light.diffuse , ( control , value ) => {
		control.header.text = "Light Color " + ( index + 1 ) ;
		lightItem.light.diffuse.r = value.r ;
		lightItem.light.diffuse.g = value.g ;
		lightItem.light.diffuse.b = value.b ;
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



Editor.prototype.addColorPickerControl = function( name , initial , updateFn ) {
	var header = new BABYLON.GUI.TextBlock() ;
	header.height = "30px" ;
	header.color = "white" ;
	this.panel.addControl( header ) ;

	var colorPicker = new BABYLON.GUI.ColorPicker() ;
	colorPicker.size = "100px" ;
	colorPicker.value = initial ;
	this.panel.addControl( colorPicker ) ;

	var control = this.controls[ name ] = { header , colorPicker } ;
	colorPicker.onValueChangedObservable.add( value => updateFn( control , value ) ) ;
	updateFn( control , colorPicker.value ) ;
} ;



Editor.prototype.manageViewInputs = function() {
	var currentMesh ,
		moving = false , drawing = false , normalSelection = false ,
		normalValue = new BABYLON.Vector3( 0 , 0 , -1 ) ;

	var pickingScreen = BABYLON.Mesh.CreatePlane( 'pickingScreen' , 10 , this.scene ) ;
	pickingScreen.position.z = -100 ;
	pickingScreen.visibility = false ;

	var updateNormal = () => {
		this.normalDynamicTexture.update() ;
		this.overlayDynamicTexture.update() ;
	} ;

	var getPickingScreenPosition = () => {
		var pickinfo = this.scene.pick( this.scene.pointerX , this.scene.pointerY , mesh => mesh === pickingScreen ) ;
		if ( pickinfo.hit ) { return pickinfo.pickedPoint ; }
		return null ;
	} ;

	var pointerDownOnLight = mesh => {
		currentMesh = mesh ;
		pickingScreen.position.z = currentMesh.position.z ;
		this.camera.detachControl( this.canvas ) ;
		moving = true ;
	} ;

	var pointerDownOnCanvas = () => {
		this.camera.detachControl( this.canvas ) ;
		drawing = true ;
	} ;

	var pointerUp = () => {
		if ( ! moving && ! drawing ) { return ; }
		if ( drawing ) { stopDrawCanvas() ; }
		pickingScreen.position.z = -100 ;
		this.camera.attachControl( this.canvas , true ) ;
		moving = drawing = false ;
	} ;

	var pointerMove = () => {
		if ( moving ) { moveLight() ; }
		if ( drawing ) { drawCanvas() ; }
	} ;

	var moveLight = () => {
		var current = getPickingScreenPosition() ;
		currentMesh.position.x = current.x ;
		currentMesh.position.y = current.y ;
	} ;

	var pointerWheel = delta => {
		if ( ! moving ) { return ; }
		currentMesh.position.z += delta ;
		pickingScreen.position.z = currentMesh.position.z ;
	} ;

	var turnNormalSphereOn = () => {
		normalSelection = true ;
		this.normalSphere.visibility = true ;
		this.sprite.visibility = false ;
	} ;

	var turnNormalSphereOff = () => {
		normalSelection = false ;
		this.normalSphere.visibility = false ;
		this.sprite.visibility = true ;
	} ;

	var pickNormal = pickInfo => {
		// The sphere is centered on 0,0,0 so we already got the normal, just need normalization
		normalValue = pickInfo.pickedPoint.normalizeToNew() ;
		this.normalCanvasEditor.setColor( helpers.normalToRgbStr( normalValue ) ) ;
	} ;

	var drawCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }
		this.normalCanvasEditor.draw( texCoord , true ) ;
		updateNormal() ;
	} ;

	var stopDrawCanvas = () => {
		if ( this.normalCanvasEditor.finishDraw() ) { updateNormal() ; }
	} ;

	var save = () => {
		this.normalCanvasEditor.save() ;
	} ;

	var load = async () => {
		await this.normalCanvasEditor.load() ;
		updateNormal() ;
	} ;

	var undo = () => {
		if ( this.normalCanvasEditor.undo() ) { updateNormal() ; }
	} ;

	var redo = () => {
		if ( this.normalCanvasEditor.redo() ) { updateNormal() ; }
	} ;

	this.scene.onPointerObservable.add( ( pointerInfo ) => {
		switch ( pointerInfo.type ) {
			case BABYLON.PointerEventTypes.POINTERDOWN :
				if ( pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh.__movable__ ) {
					pointerDownOnLight( pointerInfo.pickInfo.pickedMesh ) ;
				}
				if ( normalSelection && pointerInfo.pickInfo.pickedMesh === this.normalSphere ) {
					pickNormal( pointerInfo.pickInfo ) ;
				}
				if ( pointerInfo.pickInfo.pickedMesh === this.textureCanvas ) {
					//drawCanvas( pointerInfo.pickInfo ) ;
					pointerDownOnCanvas() ;
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
				break ;
		}
	} ) ;

	this.scene.onKeyboardObservable.add( kbInfo => {
		//console.log( "KEY: " , kbInfo.event.key , kbInfo ) ;
		switch ( kbInfo.event.key ) {
			case 'o' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { load() ; }
				break ;
			case 's' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { save() ; }
				break ;
			case 'z' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { undo() ; }
				break ;
			case 'Z' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { redo() ; }
				break ;
			case 'Control' :
				if ( kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN ) {
					turnNormalSphereOn() ;
				}
				else if ( kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP ) {
					turnNormalSphereOff() ;
				}
				break ;
		}
	} ) ;
} ;

