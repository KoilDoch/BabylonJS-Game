import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { AdvancedDynamicTexture , Button , Control} from "@babylonjs/gui";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, Color4, FreeCamera , Matrix, Quaternion, StandardMaterial, Color3 , PointLight, ShadowGenerator} from "@babylonjs/core";
import { SceneExplorerComponent } from "@babylonjs/inspector/components/sceneExplorer/sceneExplorerComponent";
import { Environment } from "./environment";
import { Player } from "./characterController";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3}

class App {
    // General Entire Application
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;
    private _environment;

    //Game State related
    public assets;
    private _player: Player;

    //Scene - related
    private _state: number = 0;
    private _gamescene: Scene;

    constructor() {
        this._canvas = this._createCanvas();

        // initialize babylon scene and engine
        this._engine = new Engine(this._canvas, true);
        this._scene = new Scene(this._engine);

        var camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), this._scene);
        camera.attachControl(this._canvas, true);
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1,1,0), this._scene);
        var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1}, this._scene);

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey)  {
                if(this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        // run the main render loop
        this._engine.runRenderLoop( () => {
            this._scene.render();
        })

    }

    /**
     * Returns a canvas object
     * 
     * @returns  A newly created canvas object
     */
    private _createCanvas() {
        var canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "gameCanvas";
        return canvas
    }

    /**
     * Sets the scene to a cutscene.
     * This scene is used for when assets are loading, displaying animations while they are set up
     */
    private async _goToCutScene() : Promise<void> {
        this._engine.displayLoadingUI();
        
        //--SCENE SETUP--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        const cutScene = AdvancedDynamicTexture.CreateFullscreenUI("CutScene");

        var finishedLoading = false;
        await this._setUpGame().then((res) => {
            finishedLoading = true;
        });

        //--PROGRESS DIALOGUE--
        const next = Button.CreateSimpleButton("next", "NEXT");
        next.color = "white";
        next.thickness = 0;
        next.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        next.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        next.width = "64px";
        next.height = "64px";
        next.top = "-3%";
        next.left = "-12%";
        cutScene.addControl(next);

        next.onPointerOutObservable.add( () => {
            this._goToGame();
        });
    }

    /**
     * When the game is loaded, this function will handle presenting it to the player.
     */
    private async _goToGame(){

        //--SETUP SCENE--
        this._scene.detachControl();
        let scene = this._gamescene;
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098);
        
        let camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);

        //--GUI--
        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        scene.detachControl();

        //create a simple button :D
        const loseBtn = Button.CreateSimpleButton("lose", "LOSE");
        loseBtn.width = 0.2
        loseBtn.height = "40px";
        loseBtn.color = "white";
        loseBtn.top = "-14px";
        loseBtn.thickness = 0;
        loseBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        playerUI.addControl(loseBtn);

        // this handles interactions with start button on scene
        loseBtn.onPointerOutObservable.add( () => {
            this._goToLose();
            scene.detachControl();
        });

        // temporary scene objects
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
        var sphere : Mesh = MeshBuilder.CreateSphere("sphere", {diameter:1} , scene);

        //primitive character and setting
        await this._initializeGameAsync(scene);

        //--WHEN SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        scene.getMeshByName("outer").position = new Vector3(0, 3, 0);

        // get rid of startt scene, switch to game scene and change states
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        // game ready, give back control
        this._scene.attachControl();
    }

    /**
     * This function creates the losing scene.
     * When the player fails this is the scene displayed, it is followed by the start scene.
     */
    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();
        
        //--SCENE SETUP--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        guiMenu.addControl(mainBtn);

        // handles interactions with the start button on this scene
        mainBtn.onPointerUpObservable.add( () => {
            this._goToStart();
        });

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI();   // hide loading when ready
        // set state and scene to lose
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }

    /**
     * The first scene that the player is presented with.
     * Following this is the cutscene while game assets loads
     */
    private async _goToStart() : Promise<void> {
        // loading UI while start scene loads
        this._engine.displayLoadingUI();

        // Create Scene
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        // Create Camera
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI();
        // set current state and scene to start scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.START

        // Create a fulscreen UI for all of our GUI elements
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720;

        // create a simple button
        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.width = 0.2;
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-14px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        guiMenu.addControl(startBtn);

        // this handles interactions with the start button in this scene
        startBtn.onPointerDownObservable.add( () => {
            //this._goToCutScene();
            scene.detachControl();
        })
    }

    private async _initializeGameAsync(scene) : Promise<void> {
        // temporary light for entire scene
        var light0 = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);

        const light = new PointLight("sparklight", new Vector3(0, 0, 0), scene);
        light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
        light.intensity = 35;
        light.radius = 1

        // shadows
        const shadowGenerator = new ShadowGenerator(1024, light);
        shadowGenerator.darkness = 0.4;

        // create the player
        this._player = new Player(this.assets, scene, shadowGenerator); //dont have inputs yet so we dont need to pass it in
    }

    private _loadCharacterAssets(scene) {

        async function loadCharacter() {
                // collision mesh
            const outer = MeshBuilder.CreateBox("outer", { width: 2, depth: 1, height: 3 }, scene);
            outer.isVisible = false;
            outer.isPickable = false;
            outer.checkCollisions = true;

            // move origin of box collider to bottom of the mesh
            outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0));

            // for collisions
            outer.ellipsoid = new Vector3(1, 1.5, 1);
            outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

            // rotate player mesh 180 to see back of character
            outer.rotationQuaternion = new Quaternion(0, 1, 0, 0);

            var box = MeshBuilder.CreateBox("smalll", {width: 0.5,
                depth: 0.5, height: 0.25, faceColors: [new Color4(0, 0, 0, 1),
                new Color4(0,0,0,1), new Color4(0, 0, 0, 1), new Color4(0, 0, 0, 1),
                new Color4(0, 0, 0, 1)]}, scene);
            box.position.y = 1.5;
            box.position.z = 1;

            var body = Mesh.CreateCylinder("body", 3, 2, 2, 0, 0, scene);
            var bodymt1 = new StandardMaterial("red", scene);
            bodymt1.diffuseColor = new Color3(0.8, 0.5, 0.5);
            body.material = bodymt1;
            body.isPickable = false;
            body.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0)); // simulates import mesh origin

            // assigns parents
            box.parent = body;
            body.parent = outer;

            return {
                mesh: outer as Mesh
            }
        }
        
        return loadCharacter().then((assets) => {
            this.assets = assets;
        });
    }

    /**
     * A simple function which creates a game scene
     */
    private async _setUpGame() {
        //--CREATE SCENE--
        let scene = new Scene(this._engine);
        this._gamescene = scene;

        //-- CREATE ENVIRONMENT--
        const environment = new Environment(scene);
        this._environment = environment;
        await this._environment.load();

        //--LOAD ASSETS
        await this._loadCharacterAssets(scene); // character
    }
    
    /**
     * Function that starts the game set up process
     */
    private async _main(): Promise<void> {
        await this._goToStart();

        // Register a render loop to repeatedly render the scene
        this._engine.runRenderLoop( () => {
            switch (this._state) {
                case State.START:
                    this._scene.render();
                    break;
                case State.CUTSCENE:
                    this._scene.render();
                    break;
                case State.GAME:
                    this._scene.render();
                    break;
                case State.LOSE:
                    this._scene.render();
                    break;
                default: break;
            }
        });

        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }
}

new App();