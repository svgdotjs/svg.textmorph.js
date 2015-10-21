

function parseXML(){

  return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");

}

function loadFont(filename, cb){

  var ajax = new XMLHttpRequest();
  ajax.onreadystatechange = function() {
    if (ajax.readyState === 4) {
      if (ajax.status === 200) {
        cb(ajax.responseXML);
      }else{
        cb()
      }
    }
  };
  ajax.open('GET', filename);
  ajax.send();

}

SVG.fonts = {}

SVG.SVGFont = SVG.invent({

  create: function(source, cb, eager){

  if(typeof cb == 'boolen'){
    eager = cb;
    cb = function(){}
  }else{
    cb = cb || function(){}
  }

  this.eager = !eager

  var node;
  var fontLoadedCb = function(node, cb){

    if(!node) throw('Given Parameter is neither XML nor ID nor a fontfile with this name was found. "'+source+'" given')

    this.source = node.getElementsByTagName('font')[0];

    SVG.fonts[this.source.firstElementChild.getAttribute('font-family')] = this//node
    this.eager ?void(null): this.loadAll()

    cb()
  }.bind(this)

  try{
    fontLoadedCb(parseXML(source))
  }catch(e){

    node = document.getElementById(source)
    node ? fontLoadedCb(node) : loadFont(source, function(node){  fontLoadedCb(node, cb)  })

  }

  },

  extend: {
    eager:true,
    cache:{},

    loadEagerly: function(glyphs){
      if(!this.eager) return

      var i = glyphs.length
      while(i--){

        if(this.cache[glyphs[i]]) continue

        this.cache[glyphs[i]] = getAttributes(this.source.querySelector('glyph[unicode="'+glyphs[i]+'"]'))

      }

    },

    loadAll: function(){
      this.eager = false

      var glyphs = this.source.querySelector('glyph')
        , i = glyphs.length

      while(i--) {
        var attr = getAttributes(glyphs[i])
        this.cache[attr.unicode] = attr
      }
    }
  }
})

function getAttributes(a){

  a = a.attributes

  var i = a.length
    , b = {}
  
  while(i--){
    b[a[i].nodeName] = SVG.regex.isNumber.test(a[i].nodeValue) ? parseFloat(a[i].nodeValue) : a[i].nodeValue
  }
  
  // ensure that the glyph has a path
  if(!b['d'])b['d'] = 'M0 0'

  return b
}

SVG.extend(SVG.Text, SVG.Tspan, {

  glyphs:[],

  text2: function(glyphs){

    var family = this.attr('font-family')
    if(!SVG.fonts[family]) throw('SVG font "'+family+'" not (yet) loaded')

    // load needed glyphs into cache
    SVG.fonts[family].loadEagerly(glyphs)

    // helper variables
    var face = SVG.fonts[family].source.firstElementChild
      , cache = SVG.fonts[family].cache
      , h = SVG.fonts[family].source.getAttribute('horiz-adv-x')
      , x = parseFloat(this.x())
      , scale = this.attr('font-size') / face.getAttribute('units-per-em')
      , capHeight = parseFloat(face.getAttribute('cap-height')) // or use em box height here??


    for(var i = 0, len = glyphs.length; i < len; ++i){

      if(glyphs[i-1]){
        hkern = SVG.fonts[family].source.querySelector('hkern[u1="'+glyphs[i-1]+'"][u2="'+glyphs[i]+'"]')
        if(hkern){
          x -= parseFloat(hkern.getAttribute('k')) * scale
        }
      }

      var p = draw.path(cache[glyphs[i]].d)

      box = p.bbox()
      
      if(box.height && box.width)
        p.size(box.width * scale, -box.height * scale)

      p.x(x).y((capHeight - box.y2)*scale + parseFloat(this.y()))

      this.glyphs.push(p)
      p.glyph = glyphs[i]

      x += parseFloat(cache[glyphs[i]]['horiz-adv-x'] || h) * scale;

    }
    
    
    this.remember('font', {
      x:x,
      y:parseFloat(this.y()),
      capHeight:capHeight,
      scale:scale
    })
    
    return this

  }


})

function fixTextLength(glyphs){

  var a = this.remember('font')
    , p

  while(this.glyphs.length < glyphs.length){
  
    p = draw.path('M0 0').move(a.x, a.capHeight*a.scale + a.y)
    p.glyph = ' '
  
    this.glyphs.push(p)
  }
  
  while(this.glyphs.length > glyphs.length){
    glyphs += ' '
  }

  // maybe move that to the top?
  while(glyphs[glyphs.length - 1] == ' ' && this.glyphs[glyphs.length - 1].glyph == ' '){
    this.glyphs.pop().remove()
    glyphs = glyphs.slice(0, - 1)
  }
  
  return glyphs

}

SVG.extend(SVG.FX, {

  text: function(glyphs){

    if(!this.target.glyphs) throw 'Text not animatable'
    
    var family = this.target.attr('font-family')
    if(!SVG.fonts[family]) throw('SVG font "'+family+'" not (yet) loaded')
    
    // this.target.glyphs are changed per reference, glyphs is returned
    glyphs = fixTextLength.call(this.target, glyphs)
    
    // load needed glyphs into cache
    SVG.fonts[family].loadEagerly(glyphs)

    // helper variables
    var face = SVG.fonts[family].source.firstElementChild
      , cache = SVG.fonts[family].cache
      , h = SVG.fonts[family].source.getAttribute('horiz-adv-x')
      , x = parseFloat(this.target.x())
      , scale = this.target.attr('font-size') / face.getAttribute('units-per-em')
      , capHeight = parseFloat(face.getAttribute('cap-height')) // or use em box height here??
      
    for(var i = 0, len = glyphs.length; i < len; ++i){

      if(glyphs[i-1]){
        hkern = SVG.fonts[family].source.querySelector('hkern[u1="'+glyphs[i-1]+'"][u2="'+glyphs[i]+'"]')
        if(hkern){
          x -= parseFloat(hkern.getAttribute('k')) * scale
        }
      }

      var p = new SVG.PathArray(cache[glyphs[i]].d)
      
      box = p.bbox()

      // ensure that we can size the box. We need width and height for that
      if(box.height && box.width)
        p.size(box.width * scale, -box.height * scale)

      // move it the path to the right position
      p.move(x,(capHeight - box.y - box.height)*scale + parseFloat(this.target.y()))

      var bbox = this.target.glyphs[i].bbox()

      if(!bbox.width || !bbox.height){
        this.target.glyphs[i].move(0, -(box.y + box.height/2)*scale)
      }else if(!box.height || !box.width){
        p.move(0,-bbox.cy * scale)
      }
      
      // update glyph representation
      this.target.glyphs[i].glyph = glyphs[i]
      
      // animate glyph
      this.target.glyphs[i].animate().plot(p)

      // update x position
      x += parseFloat(cache[glyphs[i]]['horiz-adv-x'] || h) * scale;

    }
    
    return this
  
  }

})