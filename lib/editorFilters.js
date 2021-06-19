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



const editorFilters = {} ;
module.exports = editorFilters ;



var initFiltersSubPanel = function() {
	if ( this.subPanelName === 'filters' ) { return ; }
	this.subPanelName = 'filters' ;
	this.clearSubPanel() ;

	this.addButtonControl( 'luminosity' , '[source] luminosity > value' , () => this.execFilter( 'luminosity' ) ) ;
	this.addButtonControl( 'alpha' , '[source] alpha > value' , () => this.execFilter( 'alpha' ) ) ;
	this.addButtonControl( 'alphaEmbossHeightMap' , '[source] alpha > emboss > value' , () => this.execFilter( 'alphaEmbossHeightMap' ) ) ;
	this.addButtonControl( 'alphaRoundEmbossHeightMap' , '[source] alpha > round emboss > value' , () => this.execFilter( 'alphaRoundEmbossHeightMap' ) ) ;
	this.addButtonControl( 'heightMapToNormal' , '[source] value > height > normal' , () => this.execFilter( 'heightMapToNormal' ) ) ;
	this.addButtonControl( 'mono' , 'mono' , () => this.execFilter( 'mono' ) ) ;
	this.addButtonControl( 'blur' , 'blur' , () => this.execFilter( 'blur' ) ) ;
	this.addButtonControl( 'monoBlur' , 'mono blur' , () => this.execFilter( 'monoBlur' ) ) ;
	this.addButtonControl( 'fastBlur' , 'fast blur' , () => this.execFilter( 'fastBlur' ) ) ;
	this.addButtonControl( 'horizontalBlur' , 'horizontal blur' , () => this.execFilter( 'horizontalBlur' ) ) ;
	this.addButtonControl( 'verticalBlur' , 'vertical blur' , () => this.execFilter( 'verticalBlur' ) ) ;
	this.addButtonControl( 'erosionBlur' , 'erosion blur' , () => this.execFilter( 'erosionBlur' ) ) ;
	this.addButtonControl( 'historyMix' , 'history mix' , () => this.execFilter( 'historyMix' ) ) ;

} ;



var execFilter = function( name ) {
	var current = this.canvasTypes[ this.activeCanvas ] ,
		source = this.canvasTypes[ this.sourceCanvas ] ,
		params = Object.assign( {} , this.effect ) ;

	switch ( name ) {
		case 'luminosity' :
			current.canvasEditor.luminosityFilter( source.canvasEditor.imageManipulator , params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'alpha' :
			current.canvasEditor.alphaFilter( source.canvasEditor.imageManipulator , params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'alphaEmbossHeightMap' :
			current.canvasEditor.alphaEmbossHeightMapFilter( source.canvasEditor.imageManipulator , params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'alphaRoundEmbossHeightMap' :
			params.transform = 'circular' ;
			current.canvasEditor.alphaEmbossHeightMapFilter( source.canvasEditor.imageManipulator , params ) ;
			current.dynamicTexture.update() ;
			break ;
		case 'heightMapToNormal' :
			current.canvasEditor.heightMapToNormalFilter( source.canvasEditor.imageManipulator , params ) ;
			current.dynamicTexture.update() ;
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
		case 'historyMix' :
			current.canvasEditor.historyMix( params ) ;
			current.dynamicTexture.update() ;
			break ;
	}
} ;

