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
const Promise = require( 'seventh' ) ;



function Editor() {
	this.canvas = document.getElementById( "renderCanvas" ) ;	// Get the canvas element
	this.engine = new BABYLON.Engine( this.canvas , true ) ;	// Generate the Babylon 3D engine
	this.scene = new BABYLON.Scene( this.engine ) ;
	this.scene.ambientColor = new BABYLON.Color3( 0.1 , 0.1 , 0.1 ) ;

	// Create camera and light
	this.camera = new BABYLON.ArcRotateCamera( "Camera" , -Math.PI / 2 , Math.PI / 2 , 5 , new BABYLON.Vector3( 0 , 0 , 0 ) , this.scene ) ;
	this.camera.attachControl( this.canvas , true ) ;
	this.camera.wheelPrecision = 100 ;
	this.camera.minZ = 0.05 ;

	this.sprite = null ;
	this.textureSize = null ;
	this.canvasTypes = {
		albedo: { dynamicTexture: null , canvasEditor: null } ,
		heightMap: { dynamicTexture: null , canvasEditor: null } ,
		normal: { dynamicTexture: null , canvasEditor: null }
	} ;
	
	this.brushTexture = null ;
	this.brushSprite = null ;
	
	this.drawingDynamicTexture = null ;
	this.selectionDynamicTexture = null ;

	this.textureCanvas = null ;
	this.textureCanvasDrawing = null ;
	this.textureCanvasSelection = null ;
	this.activeCanvas = 'normal' ;
	this.pixelDensity = 200 ;

	this.normalSphere = null ;

	this.lights = [] ;

	this.gui = null ;
	this.canvasTypeMenu = null ;
	this.panelMenu = null ;
	this.panel = null ;
	this.panelSubControls = [] ;
	this.subPanelName = null ;
	this.controls = {} ;

	this.brush = {
		color: { r: 128 , g: 128 , b: 255 , a: 255 } ,
		//normalizedColor: { r: 0.5 , g: 0.5 , b: 1 , a: 1 } ,
		radius: 12 ,
		hardness: 0.5 ,
		opacity: 1
	} ;

	this.effect = {
		radius: 1 ,
		intensity: 1 ,
		undersampling: 1 ,
		iteration: 1
	} ;
}

module.exports = Editor ;



Editor.prototype.init = async function() {
	// Register a render loop to repeatedly render the scene
	this.engine.runRenderLoop( () => {
		this.scene.render() ;
	} ) ;

	// Watch for browser/canvas resize events
	window.addEventListener( "resize" , () => {
		this.engine.resize() ;
	} ) ;

	this.showCursor() ;
	this.addLight( new BABYLON.Vector3( -1 , 1 , -1 ) , new BABYLON.Color3( 1 , 1 , 1 ) , 0.8 ) ;
	this.addLight( new BABYLON.Vector3( -0.7 , 1.2 , -1 ) , new BABYLON.Color3( 1 , 1 , 0.5 ) , 0.2 ) ;
	this.createBrushCursor() ;
	this.createSprite() ;
	this.createTextureCanvas() ;
	await this.createAlbedoDynamicTexture() ;
	await this.createNormalDynamicTexture() ;
	this.createHeightMapDynamicTexture() ;
	this.createNormalSphere() ;
	this.manageViewInputs() ;

	this.initPanel() ;
} ;



Editor.prototype.showCursor = function() { this.scene.defaultCursor = this.scene.hoverCursor = 'crosshair' ; } ;
Editor.prototype.hideCursor = function() { this.scene.defaultCursor = this.scene.hoverCursor = 'none' ; } ;



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
		texture = mesh.material.diffuseTexture ;

	if ( ! texture.isReady() ) {
		BABYLON.Texture.WhenAllReady( [ texture ] , () => this.scaleMeshRatioFromTexture( mesh ) ) ;
		return ;
	}

	size = texture.getBaseSize() ;
	mesh.scaling.x = size.width / this.pixelDensity ;
	mesh.scaling.y = size.height / this.pixelDensity ;
} ;



Editor.prototype.createBrushCursor = function() {
	var material = new BABYLON.StandardMaterial( 'brushCursor' , this.scene ) ;
	material.backFaceCulling = true ;

	material.ambientColor = new BABYLON.Color3( 1000 , 1000 , 1000 ) ;
	material.specularColor = new BABYLON.Color3( 0 , 0 , 0 ) ;
	material.disableLighting = true ;

	// Diffuse/Albedo
	this.brushTexture = new BABYLON.Texture( "../textures/brush.png" , this.scene ) ;
	material.diffuseTexture = this.brushTexture ;
	material.diffuseTexture.wrapU = material.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;
	material.diffuseTexture.hasAlpha = true ;
	material.useAlphaFromDiffuseTexture = true ;
    //material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND ;
    material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND ;


	// /!\ TEMP! Easier to debug!
	//material.backFaceCulling = false ;

	var mesh = BABYLON.Mesh.CreatePlane( 'brushCursor' , undefined , this.scene ) ;

	// Force billboard mode
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
	//mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_X | BABYLON.AbstractMesh.BILLBOARDMODE_Y ;

	mesh.material = material ;
	mesh.isPickable = false ;

	mesh.scaling.x = mesh.scaling.y = 0.1 ;
	mesh.position.z = 0 ;
	mesh.visibility = false ;
	mesh.renderingGroupId = 1 ;

	this.brushSprite = mesh ;
} ;



Editor.prototype.createAlbedoDynamicTexture = function() {
	var promise = new Promise() ,
		image = new Image() ;
	image.src = "../textures/camoufleur.png" ;

	image.onload = () => {
		// Create dynamic texture
		var size = this.textureSize = { width: image.naturalWidth , height: image.naturalHeight } ;
		var dynamicTexture  = this.canvasTypes.albedo.dynamicTexture = new BABYLON.DynamicTexture( 'albedoDynamicTexture' , size , this.scene ) ;
		var drawingTexture = this.drawingDynamicTexture = new BABYLON.DynamicTexture( 'drawingDynamicTexture' , size , this.scene ) ;
		var selectionTexture = this.selectionDynamicTexture = new BABYLON.DynamicTexture( 'selectionDynamicTexture' , size , this.scene ) ;
		dynamicTexture.hasAlpha = drawingTexture.hasAlpha = selectionTexture.hasAlpha = true ;
		dynamicTexture.wrapU = dynamicTexture.wrapV =
			drawingTexture.wrapU = drawingTexture.wrapV =
			selectionTexture.wrapU = selectionTexture.wrapV =
				BABYLON.Texture.CLAMP_ADDRESSMODE ;

		// Add image to dynamic texture
		var textureContext = dynamicTexture.getContext() ;
		this.canvasTypes.albedo.canvasEditor = new CanvasEditor( textureContext , drawingTexture.getContext() , selectionTexture.getContext() ) ;
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
		this.canvasTypes.normal.canvasEditor = new CanvasEditor( textureContext , this.drawingDynamicTexture.getContext() , this.selectionDynamicTexture.getContext() ) ;
		this.canvasTypes.normal.canvasEditor.setImage( image ) ;
		dynamicTexture.update() ;

		var material = this.sprite.material ;
		material.bumpTexture = dynamicTexture ;

		// BABYLONJS use DirectX normalmap, but most software export OpenGL normalmap
		material.invertNormalMapX = true ;
		material.invertNormalMapY = true ;

		this.setTextureOfTextureCanvas( dynamicTexture , this.drawingDynamicTexture , this.selectionDynamicTexture ) ;
		promise.resolve() ;
	} ;
	
	return promise ;
} ;



Editor.prototype.createHeightMapDynamicTexture = function() {
	// Create dynamic texture
	var dynamicTexture  = this.canvasTypes.heightMap.dynamicTexture = new BABYLON.DynamicTexture( 'heightMapDynamicTexture' , this.textureSize , this.scene ) ;
	dynamicTexture.wrapU = dynamicTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE ;

	// Add image to dynamic texture
	var textureContext = dynamicTexture.getContext() ;
	this.canvasTypes.heightMap.canvasEditor = new CanvasEditor( textureContext , this.drawingDynamicTexture.getContext() , this.selectionDynamicTexture.getContext() ) ;
	this.canvasTypes.heightMap.canvasEditor.updateFromCanvas() ;
	this.canvasTypes.heightMap.canvasEditor.clearOpaqueBlack() ;
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
	mesh2.position.z = -0.01 ;
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
	//console.warn( "????????? mat:" , material3 ) ;
	
	//material3.backFaceCulling = false ;	// /!\ TEMP! Easier to debug!

	var mesh3 = BABYLON.Mesh.CreatePlane( 'selectionCanvasMaterial' , 1 , this.scene ) ;

	mesh3.material = material3 ;
	mesh3.position.x = -3 ;
	mesh3.position.z = -0.02 ;
	mesh3.isPickable = false ;

	this.textureCanvasSelection = mesh3 ;
} ;



Editor.prototype.setTextureOfTextureCanvas = function(
	dynamicTexture ,
	drawingDynamicTexture = this.drawingDynamicTexture ,
	selectionDynamicTexture = this.selectionDynamicTexture
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
	if ( this.activeCanvas === type || ! this.canvasTypes[ type ] ) { return ; }
	this.activeCanvas = type ;
	this.setTextureOfTextureCanvas( this.canvasTypes[ type ].dynamicTexture ) ;
} ;



Editor.prototype.initPanel = function() {
	this.gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI( 'UI' ) ;

	this.canvasTypeMenu = new BABYLON.GUI.StackPanel() ;
	this.canvasTypeMenu.height = "50px" ;
	this.canvasTypeMenu.isVertical = false ;
	this.canvasTypeMenu.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT ;
	this.canvasTypeMenu.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP ;
	this.gui.addControl( this.canvasTypeMenu ) ;

	this.addTabControl( this.canvasTypeMenu , 'albedo' , 'albedo' , () => this.switchToCanvas( 'albedo' ) ) ;
	this.addTabControl( this.canvasTypeMenu , 'heightMap' , 'height' , () => this.switchToCanvas( 'heightMap' ) ) ;
	this.addTabControl( this.canvasTypeMenu , 'normal' , 'normal' , () => this.switchToCanvas( 'normal' ) ) ;

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

	this.addTabControl( this.panelMenu , 'view' , 'view' , () => this.initViewSubPanel() ) ;
	this.addTabControl( this.panelMenu , 'brush' , 'brush' , () => this.initBrushSubPanel() ) ;
	this.addTabControl( this.panelMenu , 'filters' , 'filters' , () => this.initFiltersSubPanel() ) ;

	this.initViewSubPanel() ;
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



Editor.prototype.initViewSubPanel = function() {
	if ( this.subPanelName === 'view' ) { return ; }
	this.subPanelName = 'view' ;
	this.clearSubPanel() ;

	this.addSliderControl( 'ambient' , 0 , 1 , this.scene.ambientColor.r , ( control , value ) => {
		if ( ! value ) { value = 0.01 ; }
		control.header.text = string.format( "Ambient intensity: %i%%" , 100 * value ) ;
		this.scene.ambientColor.r = value ;
		this.scene.ambientColor.g = value ;
		this.scene.ambientColor.b = value ;
	} ) ;

	this.lights.forEach( ( lightItem , index ) => this.addLightControls( lightItem , index ) ) ;
} ;



Editor.prototype.initBrushSubPanel = function() {
	if ( this.subPanelName === 'brush' ) { return ; }
	this.subPanelName = 'brush' ;
	this.clearSubPanel() ;

	this.addSliderControl( 'brushOpacity' , 0 , 1 , this.brush.opacity , ( control , value ) => {
		control.header.text = string.format( "Brush opacity: %i%%" , 100 * value ) ;
		this.brush.opacity = value ;
	} ) ;

	this.addSliderControl( 'brushRadius' , 0 , 50 , this.brush.radius , ( control , value ) => {
		control.header.text = string.format( "Brush radius: %[.2]f" , value ) ;
		this.brush.radius = value ;
	} ) ;

	this.addSliderControl( 'brushHardness' , 0 , 1 , this.brush.hardness , ( control , value ) => {
		control.header.text = string.format( "Brush hardness: %i%%" , 100 * value ) ;
		this.brush.hardness = value ;
	} ) ;

	this.addColorPickerControl( 'brushColor' , helpers.normalizeRgb( this.brush.color ) , ( control , value ) => {
		control.header.text = "Color" ;
		this.brush.color = helpers.denormalizeRgb( value ) ;
		this.brush.color.a = 255 ;
	} ) ;
} ;



Editor.prototype.initFiltersSubPanel = function() {
	if ( this.subPanelName === 'filters' ) { return ; }
	this.subPanelName = 'filters' ;
	this.clearSubPanel() ;

	this.addButtonControl( 'luminosityHeightMap' , 'albedo luminosity > height' , () => this.execFilter( 'luminosityHeightMap' ) ) ;
	this.addButtonControl( 'alphaHeightMap' , 'albedo alpha > height' , () => this.execFilter( 'alphaHeightMap' ) ) ;
	this.addButtonControl( 'alphaEmbossHeightMap' , 'albedo alpha > emboss > height' , () => this.execFilter( 'alphaEmbossHeightMap' ) ) ;
	this.addButtonControl( 'alphaRoundEmbossHeightMap' , 'albedo alpha > round emboss > height' , () => this.execFilter( 'alphaRoundEmbossHeightMap' ) ) ;
	this.addButtonControl( 'autoNormal' , 'height > normal' , () => this.execFilter( 'heightMapToNormal' ) ) ;
	this.addButtonControl( 'mono' , 'mono' , () => this.execFilter( 'mono' ) ) ;
	this.addButtonControl( 'blur' , 'blur' , () => this.execFilter( 'blur' ) ) ;
	this.addButtonControl( 'monoBlur' , 'mono blur' , () => this.execFilter( 'monoBlur' ) ) ;
	this.addButtonControl( 'fastBlur' , 'fast blur' , () => this.execFilter( 'fastBlur' ) ) ;
	this.addButtonControl( 'horizontalBlur' , 'horizontal blur' , () => this.execFilter( 'horizontalBlur' ) ) ;
	this.addButtonControl( 'verticalBlur' , 'vertical blur' , () => this.execFilter( 'verticalBlur' ) ) ;
	this.addButtonControl( 'erosionBlur' , 'erosion blur' , () => this.execFilter( 'erosionBlur' ) ) ;

	this.addSliderControl( 'effectRadius' , 0 , 50 , this.effect.radius , ( control , value ) => {
		control.header.text = string.format( "Effect radius: %[.2]f" , value ) ;
		this.effect.radius = value ;
	} ) ;

	this.addSliderControl( 'effectIntensity' , 0 , 10 , this.effect.intensity , ( control , value ) => {
		control.header.text = string.format( "Effect intensity: %[.2]f" , value ) ;
		this.effect.intensity = value ;
	} ) ;

	this.addSliderControl( 'effectUndersampling' , 1 , 32 , this.effect.undersampling , ( control , value ) => {
		value = Math.round( value ) ;
		control.header.text = string.format( "Effect undersampling: 1/%i" , value ) ;
		this.effect.undersampling = value ;
	} ) ;

	this.addSliderControl( 'effectIteration' , 1 , 50 , this.effect.iteration , ( control , value ) => {
		value = Math.round( value ) ;
		control.header.text = string.format( "Effect iteration: %i" , value ) ;
		this.effect.iteration = value ;
	} ) ;
} ;



Editor.prototype.addTabControl = function( menu , name , text , fn ) {
	var button = BABYLON.GUI.Button.CreateSimpleButton( name , text ) ;
	button.width = "80px" ;
	button.height = "20px" ;
	button.color = "white" ;
	button.background = "green" ;
	menu.addControl( button ) ;

	var control = this.controls[ name ] = { button } ;
	button.onPointerClickObservable.add( value => fn( control ) ) ;
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
	button.onPointerClickObservable.add( value => fn( control ) ) ;
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



Editor.prototype.execFilter = function( name ) {
	var current = this.canvasTypes[ this.activeCanvas ] ,
		params = Object.assign( {} , this.effect ) ;

	switch ( name ) {
		case 'luminosityHeightMap' :
			this.canvasTypes.heightMap.canvasEditor.luminosityHeightMapFilter( this.canvasTypes.albedo.dynamicTexture.getContext() , params ) ;
			this.canvasTypes.heightMap.dynamicTexture.update() ;
			break ;
		case 'alphaHeightMap' :
			this.canvasTypes.heightMap.canvasEditor.alphaHeightMapFilter( this.canvasTypes.albedo.dynamicTexture.getContext() , params ) ;
			this.canvasTypes.heightMap.dynamicTexture.update() ;
			break ;
		case 'alphaEmbossHeightMap' :
			this.canvasTypes.heightMap.canvasEditor.alphaEmbossHeightMapFilter( this.canvasTypes.albedo.dynamicTexture.getContext() , params ) ;
			this.canvasTypes.heightMap.dynamicTexture.update() ;
			break ;
		case 'alphaRoundEmbossHeightMap' :
			params.transform = 'circular' ;
			this.canvasTypes.heightMap.canvasEditor.alphaEmbossHeightMapFilter( this.canvasTypes.albedo.dynamicTexture.getContext() , params ) ;
			this.canvasTypes.heightMap.dynamicTexture.update() ;
			break ;
		case 'heightMapToNormal' :
			this.canvasTypes.normal.canvasEditor.heightMapToNormalFilter( this.canvasTypes.heightMap.dynamicTexture.getContext() , params ) ;
			this.canvasTypes.normal.dynamicTexture.update() ;
			break ;
		case 'mono' :
			current.canvasEditor.monoFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'blur' :
			current.canvasEditor.blurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'monoBlur' :
			current.canvasEditor.monoBlurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'fastBlur' :
			current.canvasEditor.fastBlurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'horizontalBlur' :
			current.canvasEditor.horizontalBlurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'verticalBlur' :
			current.canvasEditor.verticalBlurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'erosionBlur' :
			params.erosion = true ;
			current.canvasEditor.blurFilter( params ) ;
			current.dynamicTexture.update() ;
			break ;
	}
} ;



Editor.prototype.manageViewInputs = function() {
	var currentMesh ,
		moving = false , drawing = false , normalSelection = false ,
		normalValue = new BABYLON.Vector3( 0 , 0 , -1 ) ;

	var pickingScreen = BABYLON.Mesh.CreatePlane( 'pickingScreen' , 10 , this.scene ) ;
	pickingScreen.position.z = -100 ;
	pickingScreen.visibility = false ;

	var updateTextureCanvas = () => {
		this.canvasTypes[ this.activeCanvas ].dynamicTexture.update() ;
		this.drawingDynamicTexture.update() ;
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
		drawCanvas() ;
	} ;

	var pointerUp = () => {
		if ( ! moving && ! drawing ) { return ; }
		if ( drawing ) { stopDrawCanvas() ; }
		moving = drawing = false ;
		pickingScreen.position.z = -100 ;
		this.camera.attachControl( this.canvas , true ) ;
	} ;

	var pointerMove = () => {
		if ( moving ) { moveLight() ; }
		if ( drawing ) { drawCanvas() ; }

		var pickinfo = this.scene.pick( this.scene.pointerX , this.scene.pointerY , mesh => mesh === this.textureCanvas ) ;
		if ( ! pickinfo.hit ) {
			if ( this.brushSprite.visibility ) {
				this.brushSprite.visibility = false ;
				this.showCursor() ;
			}
			return ;
		}
		
		if ( ! this.brushSprite.visibility ) {
			let size = this.brush.radius * 2 / this.pixelDensity ;
			this.brushSprite.scaling.x = this.brushSprite.scaling.y = size ;
			this.brushSprite.visibility = true ;
			this.hideCursor() ;
		}
		
		this.brushSprite.position.x = pickinfo.pickedPoint.x ;
		this.brushSprite.position.y = pickinfo.pickedPoint.y ;
	} ;

	var moveLight = () => {
		var current = getPickingScreenPosition() ;
		if ( ! current ) { return ; }
		currentMesh.position.x = current.x ;
		currentMesh.position.y = current.y ;
	} ;

	var pointerWheel = delta => {
		if ( ! moving ) { return ; }
		currentMesh.position.z += delta * 0.2 ;
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
		normalValue.z = - normalValue.z ;
		var color = helpers.normalToRgb( normalValue ) ;
		color.a = 255 ;
		if ( this.controls.brushColor ) { this.controls.brushColor.colorPicker.value = helpers.normalizeRgb( color ) ; }
		// Assign after colorPicker, because color picker also assign it, but we want to keep precision
		this.brush.color = color ;
	} ;

	var drawCanvas = () => {
		var pickResult = this.scene.pick( this.scene.pointerX , this.scene.pointerY ) ,
			texCoord = pickResult.getTextureCoordinates() ;
		if ( ! texCoord ) { return ; }
		this.canvasTypes[ this.activeCanvas ].canvasEditor.setBrush( this.brush ) ;
		this.canvasTypes[ this.activeCanvas ].canvasEditor.draw( texCoord , true ) ;
		updateTextureCanvas() ;
	} ;

	var stopDrawCanvas = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.finishDraw() ) { updateTextureCanvas() ; }
	} ;

	var save = () => {
		this.canvasTypes[ this.activeCanvas ].canvasEditor.save() ;
	} ;

	var load = async () => {
		await this.canvasTypes[ this.activeCanvas ].canvasEditor.load() ;
		updateTextureCanvas() ;
	} ;

	var undo = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.undo() ) { updateTextureCanvas() ; }
	} ;

	var redo = () => {
		if ( this.canvasTypes[ this.activeCanvas ].canvasEditor.redo() ) { updateTextureCanvas() ; }
	} ;

	this.scene.onPointerObservable.add( ( pointerInfo ) => {
		switch ( pointerInfo.type ) {
			case BABYLON.PointerEventTypes.POINTERDOWN :
				if ( pointerInfo.event.button !== 0 ) { break ; }	// <-- not left click (left:0,middle:1,right:2)
				if ( pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh.__movable__ ) {
					pointerDownOnLight( pointerInfo.pickInfo.pickedMesh ) ;
				}
				if ( normalSelection && pointerInfo.pickInfo.pickedMesh === this.normalSphere ) {
					pickNormal( pointerInfo.pickInfo ) ;
				}
				if ( pointerInfo.pickInfo.pickedMesh === this.textureCanvas ) {
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
			case ' ' :
				if ( kbInfo.type !== BABYLON.KeyboardEventTypes.KEYDOWN ) { break ; }
				this.resetCamera() ;
				break ;
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

