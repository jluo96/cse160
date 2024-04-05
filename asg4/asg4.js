// Phong calculated based on: https://en.wikipedia.org/wiki/Phong_reflection_model

// Shaders (GLSL)
let VSHADER=`
      precision mediump float;
      attribute vec3 a_Position;
      attribute vec3 a_Normal;

      uniform mat4 u_ModelMatrix;
      uniform mat4 u_ViewMatrix;
      uniform mat4 u_ProjMatrix;

      uniform mat4 u_NormalMatrix;

      varying vec3 n;
      varying vec4 worldPos;

      void main() {
        // Mapping obj coord system to world coord system
        worldPos = u_ModelMatrix * vec4(a_Position, 1.0);

        n = normalize(u_NormalMatrix * vec4(a_Normal, 0.0)).xyz; // Normal

        gl_Position = u_ProjMatrix * u_ViewMatrix * worldPos;
      }
  `;

let FSHADER=`
    precision mediump float;
    uniform vec3 u_Color;
    uniform vec3 u_ambientColor;
    uniform vec3 u_diffuseColor;
    uniform vec3 u_specularColor;

    uniform vec3 u_lightDirection;
    uniform vec3 u_lightLocation;
    uniform vec3 u_eyePosition;

    varying vec3 n;
    varying vec4 worldPos;

    vec3 calcAmbient(){
        return u_ambientColor * u_Color;
    }

    vec3 calcDiffuse(vec3 l, vec3 n, vec3 dColor){
        float nDotL = max(dot(l, n), 0.0);
        return dColor * u_Color * nDotL;
    }

    vec3 calcSpecular(vec3 r, vec3 v){
        float rDotV = max(dot(r,v), 0.0);
        float rDotVPowS = pow(rDotV, 32.0);
        return u_specularColor * u_Color * rDotVPowS;
    }

    void main() {
        vec3 l1 = normalize(u_lightDirection); // Light direction 1
        vec3 l2 = normalize(u_lightLocation - worldPos.xyz); // Light direction 2

        vec3 v = normalize(u_eyePosition - worldPos.xyz);   // View direction

        vec3 r1 = reflect(l1, n); // Reflected light direction 1
        vec3 r2 = reflect(l2, n); // Reflected light direction 2

        // Smooth shading (Goraud)
        vec3 ambient = calcAmbient();

        vec3 diffuse1 = calcDiffuse(l1, n, u_diffuseColor);

        vec3 specular1 = calcSpecular(r1, -v);

        vec3 diffuse2 = calcDiffuse(l2, n, u_diffuseColor);

        vec3 specular2 = calcSpecular(r2, -v);

        vec3 v_Color = ambient + (diffuse1 + diffuse2) + (specular1 + specular2);
        gl_FragColor = vec4(v_Color, 1.0);
    }
`;

let modelMatrix = new Matrix4();
let normalMatrix = new Matrix4();

let models = [];

let lightDirection = new Vector3([1.0, 1.0, 1.0]);
let lightLocation = new Vector3([0.0, 0.5, 1.0]);
let lightRotation = new Matrix4().setRotate(1, 0, 1, 0);

// Uniform locations
let u_ModelMatrix = null;
let u_ViewMatrix = null;
let u_ProjMatrix = null;

let u_NormalMatrix = null;

let u_Color = null;
let u_ambientColor = null;
let u_diffuseColor = null;
let u_specularColor = null;

let u_lightDirection = null;
let u_lightLocation = null;
let u_eyePosition = null;

function drawModel(model) {
    // Update model matrix combining translate, rotate and scale from cube
    modelMatrix.setIdentity();

    // Apply translation for this part of the animal
    modelMatrix.translate(model.translate[0], model.translate[1], model.translate[2]);

    // Apply rotations for this part of the animal
    modelMatrix.rotate(model.rotate[0], 1, 0, 0);
    modelMatrix.rotate(model.rotate[1], 0, 1, 0);
    modelMatrix.rotate(model.rotate[2], 0, 0, 1);

    // Apply scaling for this part of the animal
    modelMatrix.scale(model.scale[0], model.scale[1], model.scale[2]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Compute normal matrix N_mat = (M^-1).T
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    // Set u_Color variable from fragment shader
    gl.uniform3f(u_Color, model.color[0], model.color[1], model.color[2]);

    // Send vertices and indices from model to the shaders
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

    // Draw model
    gl.drawElements(gl.TRIANGLES, model.indices.length, gl.UNSIGNED_SHORT, 0);

    //gl.uniform3f(u_Color, 0.0, 1.0, 0.0);

    //gl.drawElements(gl.LINE_LOOP, model.indices.length, gl.UNSIGNED_SHORT, 0);
}


function initBuffer(attibuteName, n) {
    let shaderBuffer = gl.createBuffer();
    if(!shaderBuffer) {
        console.log("Can't create buffer.")
        return -1;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, shaderBuffer);

    let shaderAttribute = gl.getAttribLocation(gl.program, attibuteName);
    gl.vertexAttribPointer(shaderAttribute, n, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderAttribute);

    return shaderBuffer;
}

function draw() {
    // Draw frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    lightLocation = lightRotation.multiplyVector3(lightLocation);
    gl.uniform3fv(u_lightLocation, lightLocation.elements);
    pointLightSphere.setTranslate(lightLocation.elements[0], lightLocation.elements[1], lightLocation.elements[2]);

    // Update eye position in the shader
    gl.uniform3fv(u_eyePosition, camera.eye.elements);

    // Update View matrix in the shader
    gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

    // Update Projection matrix in the shader
    gl.uniformMatrix4fv(u_ProjMatrix, false, camera.projMatrix.elements);

    for(let m of models) {
        drawModel(m);
    }

    requestAnimationFrame(draw);
}

function addModel(color, shapeType) {
    let model = null;
    switch (shapeType) {
        case "cube":
            model = new Cube(color);
            break;
        case "sphere":
            model = new Sphere(color);
            break;
    }

    if(model) {
        models.push(model);
    }

    return model;
}

function onZoomInput(value) {
    console.log(1.0 + value/10);
    camera.zoom(1.0 + value/10);
}

window.addEventListener("keydown", function(event) {
    let speed = 1.0;

    switch (event.key) {
        case "w":
            console.log("forward");
            camera.moveForward(speed);
            break;
        case "s":
            console.log("back");
            camera.moveForward(-speed);
            break;
        case "a":
            console.log("pan left");
            camera.pan(5);
            break;
        case "d":
            console.log("pan right");
            camera.pan(-5);
            break;

    }
});

window.addEventListener("mousemove", function(event) {
    // console.log(event.movementX, event.movementY);
})

function main() {
    // Retrieving the canvas tag from html document
    canvas = document.getElementById("canvas");

    // Get the rendering context for 2D drawing (vs WebGL)
    gl = canvas.getContext("webgl");
    if(!gl) {
        console.log("Failed to get webgl context");
        return -1;
    }

    // Clear screen
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compiling both shaders and sending them to the GPU
    if(!initShaders(gl, VSHADER, FSHADER)) {
        console.log("Failed to initialize shaders.");
        return -1;
    }

    // Retrieve uniforms from shaders
    u_ModelMatrix = gl.getUniformLocation(gl.program, "u_ModelMatrix");
    u_ViewMatrix = gl.getUniformLocation(gl.program, "u_ViewMatrix");
    u_ProjMatrix = gl.getUniformLocation(gl.program, "u_ProjMatrix");

    u_NormalMatrix = gl.getUniformLocation(gl.program, "u_NormalMatrix");

    u_Color = gl.getUniformLocation(gl.program, "u_Color");

    u_ambientColor = gl.getUniformLocation(gl.program, "u_ambientColor");
    u_diffuseColor = gl.getUniformLocation(gl.program, "u_diffuseColor");
    u_specularColor = gl.getUniformLocation(gl.program, "u_specularColor");

    u_lightDirection = gl.getUniformLocation(gl.program, "u_lightDirection");
    u_lightLocation = gl.getUniformLocation(gl.program, "u_lightLocation");


    u_eyePosition = gl.getUniformLocation(gl.program, "u_eyePosition");

    let n = 3;
    for (let i = -n/2; i < n/2; i++){
      let r = Math.random();
      let g = Math.random();
      let b = Math.random();

      let cube = addModel([r, g, b], "cube");
      cube.setScale(0.5, 0.5, 0.5);
      cube.setTranslate(2*i + 1.0, -0.5, 0.0);

      let sphere = addModel([r, g, b], "sphere");
      sphere.setScale(0.5, 0.5, 0.5);
      sphere.setTranslate(2*i + 1.0, 0.5, 0.0);
    }

    pointLightSphere = new Sphere([1.0, 1.0, 1.0]);
    pointLightSphere.setScale(0.1, 0.1, 0.1);
    pointLightSphere.setTranslate(lightLocation);

    models.push(pointLightSphere);

    vertexBuffer = initBuffer("a_Position", 3);
    normalBuffer = initBuffer("a_Normal", 3);

    indexBuffer = gl.createBuffer();
    if(!indexBuffer) {
        console.log("Can't create buffer.")
        return -1;
    }

    // Set light Data

    gl.uniform3f(u_ambientColor, 0.2, 0.2, 0.2);
    gl.uniform3f(u_diffuseColor, 0.8, 0.8, 0.8);
    gl.uniform3f(u_specularColor, 1.0, 1.0, 1.0);

    gl.uniform3fv(u_lightDirection, lightDirection.elements);

    // Set camera data
    camera = new Camera();

    draw();
}
