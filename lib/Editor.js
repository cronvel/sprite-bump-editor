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
const ImageManipulatorFile = require( './ImageManipulatorFile.js' ) ;
const editorFilters = require( './editorFilters.js' ) ;
const electronHelpers = require( './electronHelpers.js' ) ;
const helpers = require( './helpers.js' ) ;

const string = require( 'string-kit' ) ;
const LeanEvents = require( 'nextgen-events/lib/LeanEvents.js' ) ;
const Promise = require( 'seventh' ) ;



function Editor() {
	this.canvas = document.getElementById( "renderCanvas" ) ;	// Get the canvas element
	this.engine = new BABYLON.Engine( this.canvas , true ) ;	// Generate the Babylon 3D engine
	this.scene = new BABYLON.Scene( this.engine ) ;
	this.scene.ambientColor = new BABYLON.Color3( 0.1 , 0.1 , 0.1 ) ;
	this.lights = [] ;

	// Create camera and light
	this.camera = new BABYLON.ArcRotateCamera( "Camera" , -Math.PI / 2 , Math.PI / 2 , 5 , new BABYLON.Vector3( 0 , 0 , 0 ) , this.scene ) ;
	this.camera.attachControl( this.canvas , true ) ;
	this.camera.wheelPrecision = 100 ;
	this.camera.minZ = 0.02 ;
	this.isOrhographicCamera = false ;
	this.orhographicCameraSize = 1 ;

	this.sprite = null ;
	this.textureSize = null ;
	this.canvasTypes = {
		albedo: { dynamicTexture: null , canvasEditor: null } ,
		height: { dynamicTexture: null , canvasEditor: null } ,
		normal: { dynamicTexture: null , canvasEditor: null } ,
		specular: { dynamicTexture: null , canvasEditor: null } ,
		selection: { dynamicTexture: null , canvasEditor: null }
	} ;

	this.toolTextures = { brush: null , colorPicker: null } ;
	this.toolSprite = null ;

	this.drawingDynamicTexture = null ;

	this.textureCanvas = null ;
	this.textureCanvasDrawing = null ;
	this.textureCanvasSelection = null ;
	this.activeCanvas = 'normal' ;
	this.sourceCanvas = 'albedo' ;	// previously active canvas, used as source for some effects
	this.pixelDensity = 200 ;

	this.normalSphere = null ;
	this.normalPlane = null ;
	this.normalStick = null ;

	this.isSelectionHilighted = false ;
	this.textureCanvasSelectionAnimation = null ;

	this.activeTool = 'brush' ;

	this.gui = null ;
	this.hint = null ;
	this.toolMenu = null ;
	this.canvasTypeMenu = null ;
	this.panelMenu = null ;
	this.panel = null ;
	this.panelSubControls = [] ;
	this.subPanelName = null ;
	this.subPanelSubType = null ;
	this.controls = {} ;
	this.tabGroups = {} ;

	this.tool = {
		color: {
			r: 128 , g: 128 , b: 255 , a: 255
		} ,
		radius: 12 ,
		hardness: 0.5 ,
		opacity: 1 ,
		blurRadius: 5 ,
		tolerance: 0.1
	} ;

	this.nativeCursor = true ;
	this.spriteCursor = false ;

	this.filterParams = {} ;
}

Editor.prototype = Object.create( LeanEvents.prototype ) ;
Editor.prototype.constructor = Editor ;

module.exports = Editor ;



Editor.prototype.init = async function() {
	// Register a render loop to repeatedly render the scene
	this.engine.runRenderLoop( () => {
		this.emit( 'render' ) ;
		this.scene.render() ;
	} ) ;

	// Watch for browser/canvas resize events
	window.addEventListener( "resize" , () => {
		this.engine.resize() ;
	} ) ;

	this.setCursor( true ) ;
	this.addLight( new BABYLON.Vector3( -1 , 1 , -1 ) , new BABYLON.Color3( 1 , 1 , 1 ) , 0.8 ) ;
	this.addLight( new BABYLON.Vector3( -0.7 , 1.2 , -1 ) , new BABYLON.Color3( 1 , 1 , 0.5 ) , 0.2 ) ;
	this.createToolCursor() ;
	this.createSprite() ;
	this.createTextureCanvas() ;
	await this.createAlbedoDynamicTexture() ;
	await this.createNormalDynamicTexture() ;
	this.createHeightDynamicTexture() ;
	this.createSpecularDynamicTexture() ;
	this.createNormalSphere() ;
	this.manageViewInputs() ;

	this.initPanel() ;
} ;



Editor.prototype.setCursor = function( nativeCursor = null , spriteCursor = null , x = null , y = null ) {
	if ( nativeCursor !== null && nativeCursor !== this.nativeCursor ) {
		this.nativeCursor = nativeCursor ;
		if ( ! nativeCursor ) {
			this.scene.defaultCursor = this.scene.hoverCursor = 'none' ;
		}
		else if ( nativeCursor === true ) {
			this.scene.defaultCursor = this.scene.hoverCursor = 'crosshair' ;
		}
		else {
			this.scene.defaultCursor = this.scene.hoverCursor = nativeCursor ;
		}
	}

	if ( spriteCursor !== null && spriteCursor !== this.spriteCursor ) {
		if ( ! spriteCursor ) {
			this.spriteCursor = spriteCursor ;
			this.toolSprite.visibility = false ;
		}
		else if ( this.toolTextures[ spriteCursor ] ) {
			let size = 0.25 ;
			this.spriteCursor = spriteCursor ;
			this.toolSprite.material.diffuseTexture = this.toolTextures[ spriteCursor ] ;

			if ( spriteCursor === 'brush' ) {
				size = this.tool.radius * 2 / this.pixelDensity ;
			}

			this.toolSprite.scaling.x = this.toolSprite.scaling.y = size ;
			this.toolSprite.visibility = true ;
		}
	}

	if ( this.spriteCursor && x !== null && y !== null ) {
		this.toolSprite.position.x = x ;
		this.toolSprite.position.y = y ;
	}
} ;



Editor.prototype.addLight = function( position = null , color = null , intensity = 0.5 ) {
	var light = new BABYLON.PointLight( "PointLight" , position || new BABYLON.Vector3( -1 , 1 , -2 ) , this.scene ) ,
		mesh = BABYLON.MeshBuilder.CreateSphere( "lightMesh" , { diameter: 0.1 } , this.scene ) ,
		item = { light , mesh , automove: { enable: false , z: false } } ;

	this.lights.push( item ) ;

	light.diffuse = color || new BABYLON.Color3( 1 , 1 , 1 ) ;
	//light.specular = new BABYLON.Color3( 0 , 0 , 0 ) ;
	//light.specular = new BABYLON.Color3( 1 , 1 , 1 ) ;
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
	//material.specularPower = 0 ;	// This is the sharpness of the highlight
	//material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;

	// /!\ TEMP! Easier to debug!
	//material.backFaceCulling = false ;

	var mesh = BABYLON.Mesh.CreatePlane( 'sprite' , undefined , this.scene ) ;

	// Force billboard mode
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_X | BABYLON.AbstractMesh.BILLBOARDMODE_Y ;

	mesh.material = material ;
	mesh.isPickable = false ;

	this.sprite = mesh ;
} ;



Editor.prototype.createNormalSphere = function() {
	var material = new BABYLON.StandardMaterial( 'normalSphereMaterial' , this.scene ) ;
	material.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	//material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.backFaceCulling = true ;

	this.normalSphere = BABYLON.MeshBuilder.CreateSphere( "normalSphere" , { diameter: 2 } , this.scene ) ;
	this.normalSphere.material = material ;
	this.normalSphere.visibility = false ;
	this.normalSphere.isPickable = false ;

	var material2 = new BABYLON.StandardMaterial( 'normalPlaneMaterial' , this.scene ) ;
	material2.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	//material2.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material2.backFaceCulling = false ;

	this.normalPlane = BABYLON.Mesh.CreatePlane( 'sprite' , 0.25 , this.scene ) ;
	this.normalPlane.material = material2 ;
	this.normalPlane.position.z = -1 ;
	this.normalPlane.enableEdgesRendering() ;
	this.normalPlane.edgesWidth = 2 ;
	this.normalPlane.edgesColor = new BABYLON.Color4( 1 , 0 , 0 , 1 ) ;
	this.normalPlane.visibility = false ;
	this.normalPlane.isPickable = false ;

	this.normalStick = BABYLON.MeshBuilder.CreateBox( 'normalStickMaterial' , { height: 0.02 , width: 0.02 , depth: 0.75 } , this.scene ) ;
	this.normalStick.material = material ;
	this.normalStick.parent = this.normalPlane ;
	this.normalStick.enableEdgesRendering() ;
	this.normalStick.edgesWidth = 0.5 ;
	this.normalStick.edgesColor = new BABYLON.Color4( 0 , 1 , 0 , 1 ) ;
	this.normalStick.visibility = false ;
	this.normalStick.isPickable = false ;
} ;



Editor.prototype.scaleMeshRatioFromTexture = function( mesh ) {
	var size ,
		texture = mesh.material.diffuseTexture ;

	if ( ! texture.isReady() ) {
		BABYLON.Texture.WhenAllReady( [ texture ] , () => this.scaleMeshRatioFromTexture( mesh ) ) ;
		return ;
	}

	size = texture.getBaseSize() ;
	mesh.scaling.x = size.width / this.pixelDensity ;
	mesh.scaling.y = size.height / this.pixelDensity ;
} ;



Editor.prototype.createToolCursor = function() {
	var material = new BABYLON.StandardMaterial( 'toolCursor' , this.scene ) ;
	material.backFaceCulling = true ;

	material.ambientColor = new BABYLON.Color3( 1000 , 1000 , 1000 ) ;
	//material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.disableLighting = true ;

	// Tools
	this.toolTextures.brush = new BABYLON.Texture( "../textures/brush-tool.png" , this.scene ) ;
	this.toolTextures.colorPicker = new BABYLON.Texture( "../textures/color-picker-tool.svg" , this.scene ) ;

	for ( let toolName of Object.keys( this.toolTextures ) ) {
		let toolTexture = this.toolTextures[ toolName ] ;
		toolTexture.wrapU = toolTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;
		toolTexture.hasAlpha = true ;
	}

	// Diffuse/Albedo
	material.diffuseTexture = this.toolTextures.brush ;
	material.diffuseTexture.wrapU = material.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;
	material.diffuseTexture.hasAlpha = true ;
	material.useAlphaFromDiffuseTexture = true ;
	//material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND ;
	material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND ;


	// /!\ TEMP! Easier to debug!
	//material.backFaceCulling = false ;

	var mesh = BABYLON.Mesh.CreatePlane( 'toolCursor' , undefined , this.scene ) ;

	// Force billboard mode
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_X | BABYLON.AbstractMesh.BILLBOARDMODE_Y ;

	mesh.material = material ;
	mesh.isPickable = false ;

	mesh.scaling.x = mesh.scaling.y = 0.1 ;
	mesh.position.z = 0 ;
	mesh.visibility = false ;
	mesh.renderingGroupId = 1 ;

	this.toolSprite = mesh ;
} ;



Editor.prototype.createAlbedoDynamicTexture = function() {
	var promise = new Promise() ,
		image = new Image() ;
	image.src = "../textures/camoufleur.png" ;

	image.onload = () => {
		// Create dynamic texture
		var size = this.textureSize = { width: image.naturalWidth , height: image.naturalHeight } ;
		var dynamicTexture  = this.canvasTypes.albedo.dynamicTexture = new BABYLON.DynamicTexture( 'albedoDynamicTexture' , size , this.scene ) ;
		var selectionTexture = this.canvasTypes.selection.dynamicTexture = new BABYLON.DynamicTexture( 'selectionDynamicTexture' , size , this.scene ) ;
		var drawingTexture = this.drawingDynamicTexture = new BABYLON.DynamicTexture( 'drawingDynamicTexture' , size , this.scene ) ;
		dynamicTexture.hasAlpha = drawingTexture.hasAlpha = selectionTexture.hasAlpha = true ;
		dynamicTexture.wrapU = dynamicTexture.wrapV =
			drawingTexture.wrapU = drawingTexture.wrapV =
			selectionTexture.wrapU = selectionTexture.wrapV =
				BABYLON.Texture.CLAMP_ADDRESSMODE ;

		// Add image to dynamic texture
		this.canvasTypes.selection.canvasEditor = new CanvasEditor( selectionTexture.getContext() , drawingTexture.getContext() , null , CanvasEditor.channels.MONO_A ) ;
		this.canvasTypes.selection.canvasEditor.updateFromCanvas() ;
		this.canvasTypes.selection.canvasEditor.clear() ;

		this.canvasTypes.albedo.canvasEditor = new CanvasEditor( dynamicTexture.getContext() , drawingTexture.getContext() , this.canvasTypes.selection.canvasEditor ) ;
		this.canvasTypes.albedo.canvasEditor.setImage( image ) ;
		dynamicTexture.update() ;
		drawingTexture.update() ;
		selectionTexture.update() ;

		var material = this.sprite.material ;
		material.diffuseTexture = this.canvasTypes.albedo.dynamicTexture ;

		this.scaleMeshRatioFromTexture( this.sprite ) ;
		promise.resolve() ;
	} ;

	return promise ;
} ;



Editor.prototype.createNormalDynamicTexture = function() {
	var promise = new Promise() ,
		image = new Image() ;
	image.src = "../textures/camoufleur.normal.png" ;

	image.onload = () => {
		// Create dynamic texture
		var size = { width: image.naturalWidth , height: image.naturalHeight } ;
		if ( size.width !== this.textureSize.width || size.height !== this.textureSize.height ) {
			throw new Error( "Texture size mismatch!" ) ;
		}

		var dynamicTexture  = this.canvasTypes.normal.dynamicTexture = new BABYLON.DynamicTexture( 'normalDynamicTexture' , this.textureSize , this.scene ) ;
		dynamicTexture.wrapU = dynamicTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

		// Add image to dynamic texture
		var textureContext = dynamicTexture.getContext() ;
		this.canvasTypes.normal.canvasEditor = new CanvasEditor( textureContext , this.drawingDynamicTexture.getContext() , this.canvasTypes.selection.canvasEditor , CanvasEditor.channels.RGB ) ;
		this.canvasTypes.normal.canvasEditor.setImage( image ) ;
		dynamicTexture.update() ;

		var material = this.sprite.material ;
		material.bumpTexture = dynamicTexture ;

		// BABYLONJS use DirectX normalmap, but most software export OpenGL normalmap
		material.invertNormalMapX = true ;
		material.invertNormalMapY = true ;

		this.setTextureOfTextureCanvas( dynamicTexture , this.drawingDynamicTexture , this.canvasTypes.selection.dynamicTexture ) ;
		promise.resolve() ;
	} ;

	return promise ;
} ;



Editor.prototype.createSpecularDynamicTexture = function() {
	// Create dynamic texture
	var dynamicTexture  = this.canvasTypes.specular.dynamicTexture = new BABYLON.DynamicTexture( 'specularDynamicTexture' , this.textureSize , this.scene ) ;
	dynamicTexture.wrapU = dynamicTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

	// Add image to dynamic texture
	var textureContext = dynamicTexture.getContext() ;
	this.canvasTypes.specular.canvasEditor = new CanvasEditor( textureContext , this.drawingDynamicTexture.getContext() , this.canvasTypes.selection.canvasEditor , CanvasEditor.channels.MONO ) ;
	this.canvasTypes.specular.canvasEditor.updateFromCanvas() ;
	this.canvasTypes.specular.canvasEditor.clearOpaqueBlack() ;

	var material = this.sprite.material ;
	material.specularTexture = dynamicTexture ;

	dynamicTexture.update() ;
} ;



Editor.prototype.createHeightDynamicTexture = function() {
	// Create dynamic texture
	var dynamicTexture  = this.canvasTypes.height.dynamicTexture = new BABYLON.DynamicTexture( 'heightDynamicTexture' , this.textureSize , this.scene ) ;
	dynamicTexture.wrapU = dynamicTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

	// Add image to dynamic texture
	var textureContext = dynamicTexture.getContext() ;
	this.canvasTypes.height.canvasEditor = new CanvasEditor( textureContext , this.drawingDynamicTexture.getContext() , this.canvasTypes.selection.canvasEditor , CanvasEditor.channels.MONO ) ;
	this.canvasTypes.height.canvasEditor.updateFromCanvas() ;
	this.canvasTypes.height.canvasEditor.clearOpaqueBlack() ;
	dynamicTexture.update() ;
} ;



Editor.prototype.createTextureCanvas = function() {
	var material = new BABYLON.StandardMaterial( 'canvasMaterial' , this.scene ) ;
	material.backFaceCulling = true ;

	//material.ambientColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.ambientColor = new BABYLON.Color3( 1000 , 1000 , 1000 ) ;
	//material.diffuseColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.disableLighting = true ;
	//material.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh = BABYLON.Mesh.CreatePlane( 'canvasMaterial' , 1 , this.scene ) ;

	mesh.material = material ;
	mesh.position.x = -3 ;
	mesh.isPickable = true ;

	this.textureCanvas = mesh ;


	// Overlay 1: drawing/preview

	var material2 = new BABYLON.StandardMaterial( 'drawingCanvasMaterial' , this.scene ) ;
	material2.backFaceCulling = true ;

	//material2.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	material2.ambientColor = new BABYLON.Color3( 1000 , 1000 , 1000 ) ;
	//material2.diffuseColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	material2.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material2.disableLighting = true ;
	material2.useAlphaFromDiffuseTexture = true ;
	//console.warn( "????????? mat:" , material2 ) ;

	// https://forum.babylonjs.com/t/dynamic-texture-clear-background/17319/12
	// https://playground.babylonjs.com/#5ZCGRM#980

	//material2.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh2 = BABYLON.Mesh.CreatePlane( 'drawingCanvasMaterial' , 1 , this.scene ) ;

	mesh2.material = material2 ;
	mesh2.position.x = -3 ;
	mesh2.position.z = -0.001 ;
	mesh2.isPickable = false ;

	this.textureCanvasDrawing = mesh2 ;


	// Overlay 2: selection

	var material3 = new BABYLON.StandardMaterial( 'selectionCanvasMaterial' , this.scene ) ;
	material3.backFaceCulling = true ;

	//material3.ambientColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	material3.ambientColor = new BABYLON.Color3( 1000 , 1000 , 1000 ) ;
	//material3.diffuseColor = new BABYLON.Color3( 1 , 1 , 1 ) ;
	material3.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material3.disableLighting = true ;
	material3.useAlphaFromDiffuseTexture = true ;
	material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND ;
	//console.warn( "????????? mat:" , material3 ) ;

	//material3.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh3 = BABYLON.Mesh.CreatePlane( 'selectionCanvasMaterial' , 1 , this.scene ) ;

	mesh3.material = material3 ;
	mesh3.position.x = -3 ;
	mesh3.position.z = -0.002 ;
	mesh3.isPickable = false ;

	this.textureCanvasSelection = mesh3 ;
} ;



Editor.prototype.setTextureOfTextureCanvas = function(
	dynamicTexture ,
	drawingDynamicTexture = this.drawingDynamicTexture ,
	selectionDynamicTexture = this.canvasTypes.selection.dynamicTexture
) {
	var material = this.textureCanvas.material ;
	material.diffuseTexture = dynamicTexture ;

	var mesh  = this.textureCanvas ;
	mesh.scaling.x = this.textureSize.width / this.pixelDensity ;
	mesh.scaling.y = this.textureSize.height / this.pixelDensity ;


	// Overlay 1: drawing/preview

	var material2 = this.textureCanvasDrawing.material ;
	material2.diffuseTexture = drawingDynamicTexture ;

	var mesh2  = this.textureCanvasDrawing ;
	mesh2.scaling.x = this.textureSize.width / this.pixelDensity ;
	mesh2.scaling.y = this.textureSize.height / this.pixelDensity ;


	// Overlay 2: selection

	var material3 = this.textureCanvasSelection.material ;
	material3.diffuseTexture = selectionDynamicTexture ;

	var mesh3  = this.textureCanvasSelection ;
	mesh3.scaling.x = this.textureSize.width / this.pixelDensity ;
	mesh3.scaling.y = this.textureSize.height / this.pixelDensity ;
} ;



Editor.prototype.switchToCanvas = function( type ) {
	if ( ! this.canvasTypes[ type ] ) { return ; }

	this.manageTabSibling( type , 'canvas' ) ;
	this.sourceCanvas = this.activeCanvas ;

	if ( this.activeCanvas === type ) {
		// Here we want to use the current canvas as both active AND source
		this.sourceCanvas = this.activeCanvas ;
		this.tabGroups.canvas[ this.sourceCanvas ].button.background = "#00aa88ff" ;
		return ;
	}

	this.activeCanvas = type ;
	this.tabGroups.canvas[ this.sourceCanvas ].button.background = "#6060bbff" ;
	this.setTextureOfTextureCanvas( this.canvasTypes[ type ].dynamicTexture ) ;

	// Update the sub-panel if necessary
	if ( this.subPanelName === 'map' ) { this.initMapSubPanel() ; }
} ;



Editor.prototype.switchToTool = function( type ) {
	if ( this.activeTool === type ) { return ; }
	this.manageTabSibling( type , 'tool' ) ;
	this.activeTool = type ;
} ;



Editor.prototype.initPanel = function() {
	this.gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI( 'UI' ) ;

	this.toolMenu = new BABYLON.GUI.StackPanel() ;
	//this.toolMenu.isVertical = false ; this.toolMenu.height = "32px" ;
	this.toolMenu.isVertical = true ; this.toolMenu.width = "32px" ;
	this.toolMenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT ;
	this.toolMenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM ;
	this.gui.addControl( this.toolMenu ) ;

	this.addTabIconControl( this.toolMenu , 'tool' , 'brush' , '../textures/brush-icon.svg' , false , () => this.switchToTool( 'brush' ) , true ) ;
	this.addTabIconControl( this.toolMenu , 'tool' , 'fill' , '../textures/fill-icon.svg' , false , () => this.switchToTool( 'fill' ) ) ;
	this.addTabIconControl( this.toolMenu , 'tool' , 'blur' , '../textures/blur-icon.svg' , false , () => this.switchToTool( 'blur' ) ) ;
	this.addTabIconControl( this.toolMenu , 'tool' , 'polygonSelect' , '../textures/polygon-select-icon.svg' , false , () => this.switchToTool( 'polygonSelect' ) ) ;
	this.addTabIconControl( this.toolMenu , 'tool' , 'magicSelect' , '../textures/magic-select-icon.svg' , false , () => this.switchToTool( 'magicSelect' ) ) ;

	this.canvasTypeMenu = new BABYLON.GUI.StackPanel() ;
	this.canvasTypeMenu.height = "50px" ;
	this.canvasTypeMenu.isVertical = false ;
	this.canvasTypeMenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT ;
	this.canvasTypeMenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP ;
	this.gui.addControl( this.canvasTypeMenu ) ;

	this.addTabControl( this.canvasTypeMenu , 'canvas' , 'albedo' , 'albedo' , false , () => this.switchToCanvas( 'albedo' ) ) ;
	this.addTabControl( this.canvasTypeMenu , 'canvas' , 'normal' , 'normal' , false , () => this.switchToCanvas( 'normal' ) , true ) ;
	this.addTabControl( this.canvasTypeMenu , 'canvas' , 'specular' , 'specular' , false , () => this.switchToCanvas( 'specular' ) ) ;
	this.addTabControl( this.canvasTypeMenu , 'canvas' , 'height' , 'height' , false , () => this.switchToCanvas( 'height' ) ) ;
	this.addTabControl( this.canvasTypeMenu , 'canvas' , 'selection' , 'selection' , false , () => this.switchToCanvas( 'selection' ) ) ;
	this.tabGroups.canvas[ this.sourceCanvas ].button.background = "#6060bbff" ;

	this.panel = new BABYLON.GUI.StackPanel() ;
	this.panel.width = "250px" ;
	this.panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT ;
	this.panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER ;
	this.gui.addControl( this.panel ) ;

	this.panelMenu = new BABYLON.GUI.StackPanel() ;
	this.panelMenu.height = "50px" ;
	this.panelMenu.isVertical = false ;
	this.panelMenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT ;
	this.panelMenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP ;
	this.gui.addControl( this.panelMenu ) ;

	this.addTabControl( this.panelMenu , 'panel' , 'light' , 'light' , true , () => this.initLightSubPanel() , true ) ;
	this.addTabControl( this.panelMenu , 'panel' , 'tool' , 'tool' , true , () => this.initToolSubPanel() ) ;
	this.addTabControl( this.panelMenu , 'panel' , 'map' , 'map' , true , () => this.initMapSubPanel() ) ;
	this.addTabControl( this.panelMenu , 'panel' , 'filters' , 'filters' , true , () => this.initFiltersSubPanel() ) ;

	this.hint = new BABYLON.GUI.StackPanel() ;
	this.hint.height = "50px" ;
	this.hint.isVertical = false ;
	this.hint.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER ;
	this.hint.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM ;
	this.gui.addControl( this.hint ) ;
	this.addHintControl( 'hint' , '' ) ;

	this.initLightSubPanel() ;
} ;



Editor.prototype.clearSubPanel = function() {
	this.panelSubControls.forEach( name => {
		var subName , control ;

		for ( subName in this.controls[ name ] ) {
			control = this.controls[ name ][ subName ] ;
			this.panel.removeControl( control ) ;
			// .removeControl() seems to dispose the control
			//control.dipose() ;
		}
	} ) ;

	this.panelSubControls.length = 0 ;
} ;



Editor.prototype.initLightSubPanel = function() {
	if ( this.subPanelName === 'view' ) { return ; }
	this.subPanelName = 'view' ;
	this.subPanelSubType = null ;
	this.clearSubPanel() ;

	this.addSliderControl( 'ambient' , 0 , 1 , this.scene.ambientColor.r , ( control , value ) => {
		if ( ! value ) { value = 0.01 ; }
		control.header.text = string.format( "Ambient intensity: %P" , value ) ;
		this.scene.ambientColor.r = value ;
		this.scene.ambientColor.g = value ;
		this.scene.ambientColor.b = value ;
	} ) ;

	this.lights.forEach( ( lightItem , index ) => this.addLightControls( lightItem , index ) ) ;
} ;



Editor.prototype.initToolSubPanel = function() {
	if ( this.subPanelName === 'tool' ) { return ; }
	this.subPanelName = 'tool' ;
	this.subPanelSubType = null ;
	this.clearSubPanel() ;

	this.addSliderControl( 'toolOpacity' , 0 , 1 , this.tool.opacity , ( control , value ) => {
		control.header.text = string.format( "Tool opacity: %P" , value ) ;
		this.tool.opacity = value ;
	} ) ;

	this.addSliderControl( 'toolRadius' , 0 , 50 , this.tool.radius , ( control , value ) => {
		control.header.text = string.format( "Tool radius: %[.2]f" , value ) ;
		this.tool.radius = value ;
	} ) ;

	this.addSliderControl( 'toolHardness' , 0 , 1 , this.tool.hardness , ( control , value ) => {
		control.header.text = string.format( "Tool hardness: %P" , value ) ;
		this.tool.hardness = value ;
	} ) ;

	this.addColorPickerControl( 'toolColor' , helpers.normalizeRgb( this.tool.color ) , ( control , value ) => {
		this.tool.color = helpers.denormalizeRgb( value ) ;
		control.header.text = string.format( "Color: #%x%x%x" , this.tool.color.r , this.tool.color.g , this.tool.color.b ) ;
		this.tool.color.a = 255 ;
	} ) ;

	this.addSliderControl( 'toolBlurRadius' , 0 , 50 , this.tool.blurRadius , ( control , value ) => {
		control.header.text = string.format( "Blur radius: %[.2]f" , value ) ;
		this.tool.blurRadius = value ;
	} ) ;

	this.addSliderControl( 'toolTolerance' , 0 , 1 , this.tool.tolerance , ( control , value ) => {
		control.header.text = string.format( "Tolerance: %P" , value ) ;
		this.tool.tolerance = value ;
	} ) ;
} ;



Editor.prototype.initMapSubPanel = function() {
	if ( this.subPanelName === 'map' && this.subPanelSubType === this.activeCanvas ) { return ; }
	this.subPanelName = 'map' ;
	this.subPanelSubType = this.activeCanvas ;

	var canvas = this.canvasTypes[ this.activeCanvas ] ;

	// Common part
	this.clearSubPanel() ;
	
	var size = canvas.dynamicTexture.getSize() ;
	this.addTitleControl( 'mapSize' , string.format( '%s size: %i x %i' , this.activeCanvas , size.width , size.height ) ) ;

	// Specific part
	switch ( this.activeCanvas ) {
		case 'albedo' :
			this.initAlbedoMapSubPanel() ;
			break ;
		case 'normal' :
			this.initNormalMapSubPanel() ;
			break ;
		case 'specular' :
			this.initSpecularMapSubPanel() ;
			break ;
		case 'height' :
			this.initHeightMapSubPanel() ;
			break ;
	}

	// Common actions
	this.addButtonControl( 'clearMap' , 'clear' , () => {
		canvas.canvasEditor.clear() ;
		canvas.dynamicTexture.update() ;
	} ) ;
} ;



Editor.prototype.initAlbedoMapSubPanel = function() {
	this.addCheckboxControl( 'albedoMapEnabled' , 'enabled' , true , ( control , value ) => {
	} ) ;
} ;



Editor.prototype.initNormalMapSubPanel = function() {
	this.addCheckboxControl( 'normalMapEnabled' , 'enabled' , true , ( control , value ) => {
	} ) ;
} ;



Editor.prototype.initSpecularMapSubPanel = function() {
	this.addCheckboxControl( 'specularMapEnabled' , 'enabled' , true , ( control , value ) => {
	} ) ;
} ;



Editor.prototype.initHeightMapSubPanel = function() {
	this.addCheckboxControl( 'heightMapEnabled' , 'enabled' , true , ( control , value ) => {
	} ) ;
} ;



Editor.prototype.initFiltersSubPanel = function() {
	var filterName , filter ;

	if ( this.subPanelName === 'filters' ) { return ; }
	this.subPanelName = 'filters' ;
	this.subPanelSubType = null ;
	this.clearSubPanel() ;

	for ( [ filterName , filter ] of Object.entries( editorFilters ) ) {
		this.addButtonControl( filterName , filter.entry , ( control , filterName_ ) => this.initApplyFilterSubPanel( filterName_ ) ) ;
	}
} ;



Editor.prototype.initApplyFilterSubPanel = function( filterName ) {
	var filterParams ,
		subPanelName = 'filter:' + filterName ,
		filter = editorFilters[ filterName ] ;

	// /!\ It should use this.subPanelSubType instead of "filter:filterName" /!\
	if ( this.subPanelName === subPanelName ) { return ; }
	this.subPanelName = subPanelName ;
	this.subPanelSubType = null ;
	this.clearSubPanel() ;

	if ( ! this.filterParams[ filterName ] ) { this.filterParams[ filterName ] = {} ; }
	filterParams = this.filterParams[ filterName ] ;

	this.addTitleControl( 'filterTitle' , filter.title || filter.entry ) ;

	if ( filter.sourceRequired ) {
		this.addTitleControl( 'sourceRequired' , '-- It uses a source texture: --\n-- the blue tab --' ) ;
	}

	if ( filter.params ) {
		Object.entries( filter.params ).forEach( ( [ paramName , def ] ) => {
			var initialValue = filterParams[ paramName ] ?? def.default ;

			switch ( def.type ) {
				case 'boolean' :
					this.addCheckboxControl( paramName , def.text , initialValue , ( control , value ) => {
						filterParams[ paramName ] = value ;
					} ) ;
					break ;
				case 'enum' :
					if ( def.text ) { this.addLabelControl( paramName + 'Label' , def.text ) ; }
					this.addRadioControl( paramName , def.values , initialValue , ( control , value ) => {
						filterParams[ paramName ] = value ;
					} ) ;
					break ;
				case 'integer' :
					this.addSliderControl( paramName , def.min , def.max , initialValue , ( control , value ) => {
						value = Math.round( value ) ;
						control.header.text = string.format( def.text , value ) ;
						filterParams[ paramName ] = value ;
					} ) ;
					break ;
				case 'number' :
				default :
					this.addSliderControl( paramName , def.min , def.max , initialValue , ( control , value ) => {
						control.header.text = string.format( def.text , value ) ;
						filterParams[ paramName ] = value ;
					} ) ;
					break ;
			}
		} ) ;
	}

	this.addTitleControl( 'space' , '' ) ;

	this.addButtonControl( 'applyFilter' , 'apply' , () => {
		var current = this.canvasTypes[ this.activeCanvas ] ,
			source = this.canvasTypes[ this.sourceCanvas ] ,
			params = Object.assign( {} , filterParams , filter.hiddenParams ) ;

		if ( filter.sourceRequired ) {
			if ( ! source ) { return ; }
			current.canvasEditor[ filter.filter ]( source.canvasEditor.imageManipulator , params ) ;
		}
		else {
			current.canvasEditor[ filter.filter ]( params ) ;
		}

		current.dynamicTexture.update() ;
	} ) ;

	this.addButtonControl( 'backFilter' , 'back' , () => this.initFiltersSubPanel() ) ;
} ;



Editor.prototype.addTabControl = function( menu , tabGroup , name , text , manageSibling , fn , startOn = false ) {
	var button = BABYLON.GUI.Button.CreateSimpleButton( name , text ) ;
	button.width = "80px" ;
	button.height = "20px" ;
	button.color = "white" ;
	button.background = startOn ? "green" : "gray" ;
	menu.addControl( button ) ;

	if ( ! this.tabGroups[ tabGroup ] ) { this.tabGroups[ tabGroup ] = {} ; }
	var control = this.controls[ name ] = this.tabGroups[ tabGroup ][ name ] = { button } ;

	button.onPointerClickObservable.add( value => {
		if ( manageSibling ) { this.manageTabSibling( name , tabGroup ) ; }
		fn( control , name , tabGroup ) ;
	} ) ;
} ;



Editor.prototype.addTabIconControl = function( menu , tabGroup , name , icon , manageSibling , fn , startOn = false ) {
	var button = BABYLON.GUI.Button.CreateImageOnlyButton( name , icon ) ;
	button.width = button.height = "32px" ;
	button.color = "white" ;
	button.background = startOn ? "green" : "gray" ;
	menu.addControl( button ) ;

	if ( ! this.tabGroups[ tabGroup ] ) { this.tabGroups[ tabGroup ] = {} ; }
	var control = this.controls[ name ] = this.tabGroups[ tabGroup ][ name ] = { button } ;

	button.onPointerClickObservable.add( value => {
		if ( manageSibling ) { this.manageTabSibling( name , tabGroup ) ; }
		fn( control , name , tabGroup ) ;
	} ) ;
} ;



Editor.prototype.addLightControls = function( lightItem , index ) {
	this.addSliderControl( 'lightIntensity' + index , 0 , 2 , lightItem.light.intensity , ( control , value ) => {
		control.header.text = string.format( "Light #%i intensity: %[.2]f" , index + 1 , value ) ;
		lightItem.light.intensity = value ;
	} ) ;

	this.addColorPickerControl( 'lightColor' + index , lightItem.light.diffuse , ( control , value ) => {
		control.header.text = string.format( "Light #%i Color" , index + 1 ) ;
		lightItem.light.diffuse.r = value.r ;
		lightItem.light.diffuse.g = value.g ;
		lightItem.light.diffuse.b = value.b ;
	} ) ;

	this.addCheckboxControl( 'lightEnableAutomove' + index , 'enable move' , lightItem.automove.enable , ( control , value ) => {
		lightItem.automove.enable = value ;
		this.autoMoveLight( lightItem , index ) ;
	} ) ;

	this.addCheckboxControl( 'lightZAutomove' + index , 'Z-move' , lightItem.automove.z , ( control , value ) => {
		lightItem.automove.z = value ;
		this.autoMoveLight( lightItem , index ) ;
	} ) ;
} ;



Editor.prototype.addTitleControl = function( name , text ) {
	var header = new BABYLON.GUI.TextBlock() ;
	header.height = "50px" ;
	header.color = "white" ;
	header.text = text ;
	header.textWrapping = true ;
	this.panel.addControl( header ) ;

	var control = this.controls[ name ] = { header } ;
	this.panelSubControls.push( name ) ;
} ;



Editor.prototype.addLabelControl = function( name , text ) {
	var header = new BABYLON.GUI.TextBlock() ;
	header.height = "20px" ;
	header.color = "white" ;
	header.text = text ;
	header.textWrapping = true ;
	header.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT ;
	this.panel.addControl( header ) ;

	var control = this.controls[ name ] = { header } ;
	this.panelSubControls.push( name ) ;
} ;



Editor.prototype.addHintControl = function( name , text ) {
	var header = new BABYLON.GUI.TextBlock() ;
	//header.height = "50px" ;
	header.width = "400px" ;
	header.color = "white" ;
	header.text = text ;
	this.hint.addControl( header ) ;

	var control = this.controls[ name ] = { header } ;
} ;



Editor.prototype.addButtonControl = function( name , text , fn ) {
	var button = BABYLON.GUI.Button.CreateSimpleButton( name , text ) ;
	button.width = "250px" ;
	button.height = "30px" ;
	button.fontSize = "14px" ;
	button.color = "white" ;
	button.background = "green" ;
	this.panel.addControl( button ) ;

	var control = this.controls[ name ] = { button } ;
	this.panelSubControls.push( name ) ;
	button.onPointerClickObservable.add( value => fn( control , name ) ) ;
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
	this.panelSubControls.push( name ) ;
	slider.onValueChangedObservable.add( value => updateFn( control , value ) ) ;
	updateFn( control , slider.value ) ;
} ;



Editor.prototype.addCheckboxControl = function( name , text , initial , updateFn ) {
	var checkbox = new BABYLON.GUI.Checkbox() ;
	checkbox.width = "20px" ;
	checkbox.height = "20px" ;
	checkbox.isChecked = true ;
	checkbox.color = "green" ;
	checkbox.isChecked = !! initial ;
	//this.panel.addControl( checkbox ) ;

	var header = BABYLON.GUI.Control.AddHeader( checkbox , text , "120px" , { isHorizontal: true , controlFirst: true } ) ;
	header.height = "30px" ;
	header.color = "white" ;
	this.panel.addControl( header ) ;

	var control = this.controls[ name ] = { header , checkbox } ;
	this.panelSubControls.push( name ) ;
	checkbox.onIsCheckedChangedObservable.add( value => updateFn( control , value ) ) ;
	updateFn( control , initial ) ;
} ;



Editor.prototype.addRadioControl = function( name , entries , initial , updateFn ) {
	var control = this.controls[ name ] = {} ;

	entries.forEach( entry => {
		var radio = new BABYLON.GUI.RadioButton() ;
		//radio.value = entry ;
		radio.color = "white" ;
		radio.background = "green" ;
		radio.group = name ;
		radio.height = "20px" ;
		radio.width = "20px" ;
		if ( entry === initial ) { radio.isChecked = true ; }

		var header = BABYLON.GUI.Control.AddHeader( radio , entry , "100px" , { isHorizontal: true , controlFirst: true } ) ;
		header.height = "30px" ;
		header.color = "white" ;
		control[ 'radio:' + entry ] = header ;
		//this.panel.addControl( radio ) ;
		this.panel.addControl( header ) ;

		radio.onIsCheckedChangedObservable.add( state => {
			if ( state ) { updateFn( control , entry ) ; }
		} ) ;
	} ) ;

	this.panelSubControls.push( name ) ;
	updateFn( control , initial ) ;
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
	this.panelSubControls.push( name ) ;
	colorPicker.onValueChangedObservable.add( value => updateFn( control , value ) ) ;
	updateFn( control , colorPicker.value ) ;
} ;



Editor.prototype.resetCamera = function() {
	// Change target first! Or some bug will kick in!
	this.camera.target.x = 0 ;
	this.camera.target.y = 0 ;
	this.camera.target.z = 0 ;

	this.camera.alpha = -Math.PI / 2 ;
	this.camera.beta = Math.PI / 2 ;
	this.camera.radius = 5 ;
} ;



Editor.prototype.switchCameraMode = function( orthographic = ! this.isOrhographicCamera ) {
	orthographic = !! orthographic ;
	if ( orthographic === this.isOrhographicCamera ) { return ; }
	this.isOrhographicCamera = orthographic ;

	if ( this.isOrhographicCamera ) {
		this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA ;
		this.updateOrthographicCamera( this.camera.radius ) ;
	}
	else {
		this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA ;
	}
} ;



Editor.prototype.updateOrthographicCamera = function( size = this.orhographicCameraSize ) {
	var clientRect = this.scene.getEngine().getRenderingCanvasClientRect() ,
		aspect = clientRect.width / clientRect.height ,
		sqrtAspect = Math.sqrt( aspect ) ;
	
	this.orhographicCameraSize = size ;

	this.camera.orthoLeft = - size * sqrtAspect / 2 ;
	this.camera.orthoRight = size * sqrtAspect / 2 ;
	this.camera.orthoBottom = - size / sqrtAspect / 2 ;
	this.camera.orthoTop = size / sqrtAspect / 2 ;
} ;



Editor.prototype.clearHint = function() { this.controls.hint.header.text = '' ; } ;
Editor.prototype.setHint = function( text ) { this.controls.hint.header.text = text ; } ;
Editor.prototype.setTmpHint = function( text ) {
	this.setHint( text ) ;
	setTimeout( () => this.clearHint() , 3000 ) ;
} ;



Editor.prototype.autoMoveLight = function( lightItem , index ) {
	var listenerId = 'light' + index ;
	this.off( 'render' , listenerId ) ;
	if ( ! lightItem.automove.enable ) { return ; }

	var radius , phase , angularSpeed ,
		startTime = Date.now() / 1000 ,
		position = lightItem.mesh.position ;

	if ( lightItem.automove.z ) {
		radius = Math.hypot( position.x , position.z ) ;
		phase = Math.atan2( position.z , position.x ) ;
		angularSpeed = -1 ;

		this.on( 'render' , () => {
			var t = ( Date.now() / 1000 ) - startTime ;
			position.x = radius * Math.cos( t * angularSpeed + phase ) ;
			position.z = radius * Math.sin( t * angularSpeed + phase ) ;
		} , listenerId ) ;
	}
	else {
		radius = Math.hypot( position.x , position.y ) ;
		phase = Math.atan2( position.y , position.x ) ;
		angularSpeed = -1 ;

		this.on( 'render' , () => {
			var t = ( Date.now() / 1000 ) - startTime ;
			position.x = radius * Math.cos( t * angularSpeed + phase ) ;
			position.y = radius * Math.sin( t * angularSpeed + phase ) ;
		} , listenerId ) ;
	}
} ;



const HILIGHT_EASING = new BABYLON.CubicEase() ;
HILIGHT_EASING.setEasingMode( BABYLON.EasingFunction.EASINGMODE_EASEINOUT ) ;

Editor.prototype.hilightSelection = function( hilight = true ) {
	var frameRate = 30 ,
		animation = this.textureCanvasSelectionAnimation ;

	hilight = !! hilight ;
	if ( hilight === this.isSelectionHilighted ) { return ; }

	this.isSelectionHilighted = hilight ;

	if ( animation ) {
		this.scene.removeAnimation( animation ) ;
		this.textureCanvasSelectionAnimation = null ;
		this.textureCanvasSelection.animations.length = 0 ;
	}

	if ( hilight ) {
		this.textureCanvasSelectionAnimation = animation = new BABYLON.Animation(
			'hilightSelection' ,
			'material.alpha' ,
			30 ,	// fps
			BABYLON.Animation.ANIMATIONTYPE_FLOAT ,
			BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
		) ;

		animation.setKeys( [
			{ frame: 0 , value: 0 } ,
			{ frame: 1.6 * frameRate , value: 0.2 } ,
			{ frame: 3.2 * frameRate , value: 0 } ,
			{ frame: 3.5 * frameRate , value: 0 }
		] ) ;

		// Creating an easing function
		animation.setEasingFunction( HILIGHT_EASING ) ;

		this.textureCanvasSelection.animations.push( animation ) ;
		this.scene.beginAnimation( this.textureCanvasSelection , 0 , 4 * frameRate , true ) ;
	}
} ;



Editor.prototype.updateNormalStickDirection = function() {
	var normalValue = helpers.rgbToNormal( this.tool.color , this.normalPlane.position ) ;
	normalValue.z = -normalValue.z ;	// Babylon is left-handed
	this.normalPlane.rotation.y = Math.atan2( -normalValue.x , -normalValue.z ) ;
	var dxz = Math.sqrt( normalValue.x * normalValue.x + normalValue.z * normalValue.z ) ;
	this.normalPlane.rotation.x = Math.atan2( normalValue.y , dxz ) ;
	//console.warn( "rotation Y:" , this.normalPlane.rotation.y ) ;
} ;



Editor.prototype.pickNormalAt = function( position ) {
	// The sphere is centered on 0,0,0 so we already got the normal, just need normalization
	var normalValue = position.normalizeToNew() ;
	normalValue.z = -normalValue.z ;	// Babylon is left-handed
	var color = helpers.normalToRgb( normalValue ) ;
	color.a = 255 ;
	if ( this.controls.toolColor ) { this.controls.toolColor.colorPicker.value = helpers.normalizeRgb( color ) ; }
	// Assign after colorPicker, because color picker also assign it, but we want to keep precision
	this.tool.color = color ;
	this.updateNormalStickDirection() ;
} ;



Editor.prototype.manageTabSibling = function( activeName , tabGroup ) {
	var sibling ;

	for ( sibling in this.tabGroups[ tabGroup ] ) {
		if ( sibling === activeName ) {
			this.tabGroups[ tabGroup ][ sibling ].button.background = "green" ;
		}
		else {
			this.tabGroups[ tabGroup ][ sibling ].button.background = "gray" ;
		}
	}
} ;



Editor.prototype.saveProject = async function( filePath ) {
	var imageManipulatorFile = new ImageManipulatorFile( {
		//compression: 'raw' ,
		perImageBlocks: true ,
		blocks: [
			{ imageKey: 'albedo' , channels: [ 'alpha' ] , isZeroChannel: true } ,
			{
				imageKey: 'albedo' , channels: [ 'red' , 'green' , 'blue' ] , skipZero: true , skippedValues: [ 0 , 0 , 0 ]
			} ,
			{
				imageKey: 'normal' , channels: [ 'red' , 'green' ] , skipZero: true , skippedValues: [ 128 , 128 ]
			} ,
			{
				imageKey: 'specular' , channels: [ 'mono' ] , skipZero: true , skippedValues: [ 0 ]
			} ,
			{
				imageKey: 'height' , channels: [ 'mono' ] , skipZero: true , skippedValues: [ 0 ]
			}
		]
	} ) ;

	await imageManipulatorFile.saveMulti( filePath , {
		albedo: this.canvasTypes.albedo.canvasEditor.imageManipulator ,
		normal: this.canvasTypes.normal.canvasEditor.imageManipulator ,
		specular: this.canvasTypes.specular.canvasEditor.imageManipulator ,
		height: this.canvasTypes.height.canvasEditor.imageManipulator
	} ) ;
} ;



Editor.prototype.loadProject = async function( filePath ) {
	var canvasEditor , data , name ,
		names = [ 'albedo' , 'normal' , 'specular' , 'height' ] ,
		copyChannels = {
			albedo: [ 'red' , 'green' , 'blue' , 'alpha' ] ,
			normal: [ 'red' , 'green' ] ,
			specular: [ 'mono' ] ,
			height: [ 'mono' ]
		} ;

	data = await ImageManipulatorFile.load( filePath ) ;
	if ( ! data.multi ) { throw new Error( "Expecting a multi image, but found a single image" ) ; }

	for ( name of names ) {
		if ( ! data.imageManipulators[ name ] ) { continue ; }
		canvasEditor = this.canvasTypes[ name ].canvasEditor ;
		data.imageManipulators[ name ].copyChannelsTo( canvasEditor.imageManipulator , null , copyChannels[ name ] ) ;
		//data.imageManipulators[ name ].compatibleCopyTo( canvasEditor.imageManipulator , null , copyChannels[ name ] ) ;
		if ( name === 'normal' ) { canvasEditor.imageManipulator.normalizeNormals( true ) ; }
		canvasEditor.updateToCanvas() ;
		canvasEditor.pushHistory() ;
		this.canvasTypes[ name ].dynamicTexture.update() ;
	}
} ;



Editor.prototype.manageViewInputs = function() {
	var currentMesh ,
		lightMoving = false , brushDrawing = false , blurDrawing = false , polygonSelecting = false ,
		colorPicking = false ;

	var pickingScreen = BABYLON.Mesh.CreatePlane( 'pickingScreen' , 10 , this.scene ) ;
	pickingScreen.position.z = -100 ;
	pickingScreen.visibility = false ;

	var updateTextureCanvas = ( updateSelection ) => {
		this.canvasTypes[ this.activeCanvas ].dynamicTexture.update() ;
		this.drawingDynamicTexture.update() ;
		if ( updateSelection ) { this.canvasTypes.selection.dynamicTexture.update() ; }
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
		lightMoving = true ;
	} ;

	var pointerDownOnCanvas = () => {
		switch ( this.activeTool ) {
			case 'brush' :
				this.camera.detachControl( this.canvas ) ;
				brushDrawing = true ;
				drawCanvas() ;
				break ;
			case 'blur' :
				this.camera.detachControl( this.canvas ) ;
				blurDrawing = true ;
				drawBlurCanvas() ;
				break ;
			case 'polygonSelect' :
				this.camera.detachControl( this.canvas ) ;
				polygonSelecting = true ;
				polygonSelectCanvas() ;
				break ;
			case 'fill' :
				fillCanvas() ;
				break ;
			case 'magicSelect' :
				magicSelectCanvas() ;
				break ;
		}
	} ;

	var pointerUp = () => {
		if ( polygonSelecting ) { return ; }
		if ( ! lightMoving && ! brushDrawing && ! blurDrawing ) { return ; }
		if ( brushDrawing || blurDrawing ) { stopDrawCanvas() ; }
		lightMoving = brushDrawing = blurDrawing = false ;
		pickingScreen.position.z = -100 ;
		this.camera.attachControl( this.canvas , true ) ;
	} ;

	var pointerMove = () => {
		if ( lightMoving ) { moveLight() ; }
		if ( brushDrawing ) { drawCanvas() ; }
		if ( blurDrawing ) { drawBlurCanvas() ; }

		var pickinfo = this.scene.pick( this.scene.pointerX , this.scene.pointerY , mesh => mesh === this.textureCanvas ) ;
		if ( ! pickinfo.hit ) {
			this.setCursor( true , false ) ;
		}
		else if ( colorPicking ) {
			this.setCursor( false , 'colorPicker' , pickinfo.pickedPoint.x , pickinfo.pickedPoint.y ) ;
		}
		else if ( this.activeTool === 'brush' || this.activeTool === 'blur' ) {
			this.setCursor( false , 'brush' , pickinfo.pickedPoint.x , pickinfo.pickedPoint.y ) ;
		}
		else if ( this.toolSprite.visibility ) {
			this.setCursor( true , false ) ;
		}
	} ;

	var moveLight = () => {
		var current = getPickingScreenPosition() ;
		if ( ! current ) { return ; }
		currentMesh.position.x = current.x ;
		currentMesh.position.y = current.y ;
	} ;

	var pointerWheel = delta => {
		if ( this.isOrhographicCamera ) { this.updateOrthographicCamera( this.orhographicCameraSize * ( 1 + delta * 0.2 ) ) ; }
		if ( ! lightMoving ) { return ; }
		currentMesh.position.z += delta * 0.2 ;
		pickingScreen.position.z = currentMesh.position.z ;
	} ;

	var turnColorPickingOn = () => {
		colorPicking = true ;
		this.updateNormalStickDirection() ;
		this.normalSphere.visibility = this.normalPlane.visibility = this.normalStick.visibility = true ;
		this.normalSphere.isPickable = true ;
		this.sprite.visibility = false ;
	} ;

	var turnColorPickingOff = () => {
		colorPicking = false ;
		this.normalSphere.visibility = this.normalPlane.visibility = this.normalStick.visibility = false ;
		this.normalSphere.isPickable = false ;
		this.sprite.visibility = true ;
	} ;

	var pickNormal = pickInfo => {
		this.pickNormalAt( pickInfo.pickedPoint ) ;
	} ;

	var pickColorOnCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		var color = this.canvasTypes[ this.activeCanvas ].canvasEditor.pickColor( texCoord , true ) ;
		color.a = 255 ;
		//console.warn( "picking color:" , color ) ;
		if ( this.controls.toolColor ) { this.controls.toolColor.colorPicker.value = helpers.normalizeRgb( color ) ; }
		// Assign after colorPicker, because color picker also assign it, but we want to keep precision
		this.tool.color = color ;
		this.updateNormalStickDirection() ;
	} ;

	var drawCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		this.canvasTypes[ this.activeCanvas ].canvasEditor.setTool( this.tool ) ;
		this.canvasTypes[ this.activeCanvas ].canvasEditor.draw( texCoord , true ) ;
		updateTextureCanvas() ;
	} ;

	var drawBlurCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		this.canvasTypes[ this.activeCanvas ].canvasEditor.setTool( this.tool ) ;
		this.canvasTypes[ this.activeCanvas ].canvasEditor.draw( texCoord , true , {
			type: 'blur' ,
			radius: this.tool.blurRadius
		} ) ;

		updateTextureCanvas() ;
	} ;

	var stopDrawCanvas = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.finishDraw() ) { updateTextureCanvas() ; }
	} ;

	var fillCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		this.canvasTypes[ this.activeCanvas ].canvasEditor.setTool( this.tool ) ;
		this.canvasTypes[ this.activeCanvas ].canvasEditor.fill( texCoord , true ) ;
		updateTextureCanvas() ;
	} ;

	var polygonSelectCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		this.canvasTypes.selection.canvasEditor.addPolygonPoint( texCoord , true ) ;
		updateTextureCanvas() ;
	} ;

	var stopSelectPolygonCanvas = () => {
		this.canvasTypes.selection.canvasEditor.finishPolygon() ;
		updateTextureCanvas( true ) ;
		this.hilightSelection() ;
		this.canvasTypes.selection.canvasEditor.meta.isActiveMask = true ;
		polygonSelecting = false ;
		this.camera.attachControl( this.canvas , true ) ;
	} ;

	var magicSelectCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }

		this.canvasTypes[ this.activeCanvas ].canvasEditor.setTool( this.tool ) ;
		this.canvasTypes[ this.activeCanvas ].canvasEditor.magicSelect( this.canvasTypes.selection.canvasEditor , texCoord , true ) ;
		updateTextureCanvas( true ) ;
		this.hilightSelection() ;
		this.canvasTypes.selection.canvasEditor.meta.isActiveMask = true ;
	} ;

	var unselect = () => {
		this.canvasTypes.selection.canvasEditor.clear() ;
		updateTextureCanvas( true ) ;
		this.hilightSelection( false ) ;
		this.canvasTypes.selection.canvasEditor.meta.isActiveMask = false ;
		polygonSelecting = false ;
		this.camera.attachControl( this.canvas , true ) ;
	} ;

	var save = async ( mode ) => {
		var filePath = await electronHelpers.saveDialog() ;
		if ( ! filePath ) { return ; }
		this.setHint( 'Saving...' ) ;

		if ( mode === 'project' ) {
			await this.saveProject( filePath ) ;
		}
		else {
			await this.canvasTypes[ this.activeCanvas ].canvasEditor.save( filePath , mode ) ;
		}

		this.setTmpHint( 'Saved!' ) ;
	} ;

	var load = async ( mode ) => {
		var filePath = await electronHelpers.loadDialog() ;
		if ( ! filePath ) { return ; }
		this.setHint( 'Loading...' ) ;

		if ( mode === 'project' ) {
			await this.loadProject( filePath ) ;
		}
		else {
			await this.canvasTypes[ this.activeCanvas ].canvasEditor.load( filePath , mode ) ;
		}

		updateTextureCanvas() ;
		this.setTmpHint( 'Loaded!' ) ;
	} ;

	var undo = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.undo() ) { updateTextureCanvas() ; }
	} ;

	var redo = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.redo() ) { updateTextureCanvas() ; }
	} ;

	this.scene.onPointerObservable.add( ( pointerInfo ) => {
		//console.log( "POINTER: " , pointerInfo.type , pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE , pointerInfo ) ;
		switch ( pointerInfo.type ) {
			case BABYLON.PointerEventTypes.POINTERDOWN :
				if ( pointerInfo.event.button !== 0 ) { break ; }	// <-- not left click (left:0,middle:1,right:2)
				if ( pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh.__movable__ ) {
					pointerDownOnLight( pointerInfo.pickInfo.pickedMesh ) ;
				}
				if ( colorPicking && pointerInfo.pickInfo.pickedMesh === this.normalSphere ) {
					pickNormal( pointerInfo.pickInfo ) ;
				}
				if ( pointerInfo.pickInfo.pickedMesh === this.textureCanvas ) {
					if ( colorPicking ) { pickColorOnCanvas() ; }
					else { pointerDownOnCanvas() ; }
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
			case ' ' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				this.resetCamera() ;
				break ;
			case 'c' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				this.switchCameraMode() ;
				break ;
			case 'o' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.altKey ) { load( 'project' ) ; break ; }
				if ( kbInfo.event.ctrlKey ) { load( 'image' ) ; break ; }
				break ;
			case 'O' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { load( 'custom' ) ; break ; }
				break ;
			case 's' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.altKey ) { save( 'project' ) ; break ; }
				if ( kbInfo.event.ctrlKey ) { save( 'png' ) ; break ; }
				this.switchToTool( 'polygonSelect' ) ;
				break ;
			case 'S' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				//if ( kbInfo.event.ctrlKey ) { save( 'raw' ) ; break ; }
				if ( kbInfo.event.ctrlKey ) { save( 'custom' ) ; break ; }
				break ;
			case 'd' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { break ; }
				this.switchToTool( 'brush' ) ;
				break ;
			case 'b' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { break ; }
				this.switchToTool( 'blur' ) ;
				break ;
			case 'm' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { break ; }
				this.switchToTool( 'magicSelect' ) ;
				break ;
			case 'z' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { undo() ; }
				break ;
			case 'Z' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { redo() ; }
				break ;
			case 'Enter' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { break ; }
				if ( polygonSelecting ) { stopSelectPolygonCanvas() ; }
				break ;
			case 'Escape' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				if ( kbInfo.event.ctrlKey ) { break ; }
				unselect() ;
				break ;
			case 'Control' :
				if ( kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN ) { turnColorPickingOn() ; }
				else if ( kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP ) { turnColorPickingOff() ; }
				break ;
		}
	} ) ;
} ;

