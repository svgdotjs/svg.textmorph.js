function parseXML(xmlStr){

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

  create: function(source, cb, lazy, undefined){

    if(typeof cb == 'boolean'){
      lazy = cb;
      cb = function(){}
    }else{
      cb = cb || function(){}
    }

    cb = cb.bind(this)

    this.lazy = lazy === undefined ? true : false

    var node;
    var fontLoadedCb = function(node, cb){

      if(!node) throw('Given Parameter is neither XML nor ID nor a fontfile with this name was found. "'+source+'" given')

      this.source = node.getElementsByTagName('font')[0];
      this.family = this.source.firstElementChild.getAttribute('font-family')

      SVG.fonts[this.family] = this
      this.lazy || this.loadAll()

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
    lazy:true,
    cache:{},

    loadLazy: function(glyphs){
      if(!this.lazy) return

      var i = glyphs.length
      while(i--){

        if(this.cache[glyphs[i]]) continue

        this.cache[glyphs[i]] = getPathAttributes(this.source.querySelector('glyph[unicode="'+glyphs[i]+'"]'))

      }
      
      return this

    },

    loadAll: function(){
      this.lazy = false

      var glyphs = this.source.querySelectorAll('glyph')
        , i = glyphs.length

      while(i--) {
        var attr = getPathAttributes(glyphs[i])
        this.cache[attr.unicode] = attr
      }
      
      return this
    },

    fontSize: function(size){
      this.size = parseFloat(size)
      return this
    },

    getPathArray: function(glyphs, cb){

      // load needed glyphs into cache
      this.loadLazy(glyphs)

      // helper variables
      var uPerEm = this.source.firstElementChild.getAttribute('units-per-em')
        , cache = this.cache
        , h = this.source.getAttribute('horiz-adv-x')
        , x = 0
        , scale = this.size / uPerEm

      for(var i = 0, len = glyphs.length; i < len; ++i){

        if(glyphs[i-1]){
          hkern = this.source.querySelector('hkern[u1="'+glyphs[i-1]+'"][u2="'+glyphs[i]+'"]')
          if(hkern){
            x -= parseFloat(hkern.getAttribute('k')) * scale
          }
        }

        var p = new SVG.PathArray(cache[glyphs[i]].d)
          , box = p.bbox()

        if(box.height && box.width)
          p.size(box.width * scale, -box.height * scale)

        p.move(x,(uPerEm - box.y - box.height)*scale)

        cb.call(this, p, i)

        x += parseFloat(cache[glyphs[i]]['horiz-adv-x'] || h) * scale;

      }

      return {
        x:x,
        uPerEm:uPerEm,
        scale:scale
      }
    }
  }
})

function getPathAttributes(a){

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

SVG.MorphText = SVG.invent({
  // Initialize node
  create: 'g'

  // Inherit from
, inherit: SVG.G

  // Add class methods
, extend: {

    glyphs:[]
  , family:SVG.defaults.attrs['font-family'].split(',')[0].trim()
  , size:SVG.defaults.attrs['font-size']
  , font: function(k, v){

      if(v == null){
        for(var i in k) this.font(i, k[i])
        return this
      }

      this[k] = v

      this.text(this.content)
      return this
    }
  , text: function(glyphs){
  
      this.content = glyphs
      this.clear()
      this.glyphs = []

      var svgFont = this.family instanceof SVG.SVGFont ? this.family : SVG.fonts[this.family]
      
      if(!svgFont) return this

      var font = svgFont
        .fontSize(this.size)
        .getPathArray(glyphs, function(pathArray, index){

          var p = this.path(pathArray)

          this.glyphs.push(p)
          p.glyph = glyphs[index]

        }.bind(this))

      this.remember('font', font)

      return this

    }

  }

, construct: {
    // Create a group element
    morphText: function(text) {
      return this.put(new SVG.MorphText).text(text)
    }
  }


})

function fixTextLength(glyphs){

  var a = this.remember('font')
    , p

  while(this.glyphs.length < glyphs.length){

    p = this.path('M0 0').move(a.x, a.uPerEm*a.scale)
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

    var svgFont = this.target.family instanceof SVG.SVGFont ? this.target.family : SVG.fonts[this.target.family]
    
    if(!svgFont) throw('SVG font "'+svgFont.family+'" not (yet) loaded')

    // this.target.glyphs are changed per reference, glyphs is returned
    glyphs = fixTextLength.call(this.target, glyphs)

    var font = svgFont
      .fontSize(this.target.size)
      .getPathArray(glyphs, function(pathArray, index){

        var bbox = this.glyphs[index].bbox()
        var box = pathArray.bbox()

        var scale = this.remember('font').scale

        if(!bbox.width || !bbox.height){
          this.glyphs[index].move(0, -box.height/2)
        }else if(!box.height || !box.width){
          pathArray.move(0,-bbox.height/2)
        }

        // update glyph representation
        this.glyphs[index].glyph = glyphs[index]

        // animate glyph
        this.glyphs[index].animate().plot(pathArray)
      }.bind(this.target))


    return this

  }

})
