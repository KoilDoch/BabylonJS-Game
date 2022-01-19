import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { AdvancedDynamicTexture , Button , Control} from "@babylonjs/gui";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, Color4, FreeCamera } from "@babylonjs/core";
import { SceneExplorerComponent } from "@babylonjs/inspector/components/sceneExplorer/sceneExplorerComponent";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3}

class App {
    // General Entire Application
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

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

    private _createCanvas() {
        var canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "gameCanvas";
        return canvas
    }

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

        // get rid of startt scene, switch to game scene and change states
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        // game ready, give back control
        this._scene.attachControl();

    }

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

    private async _setUpGame() {
        let scene = new Scene(this._engine);
        this._gamescene = scene;
    }
}

new App();