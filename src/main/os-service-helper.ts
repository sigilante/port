import { app, autoUpdater, BrowserView, BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import isDev from 'electron-is-dev'
import { ViewData } from '../background/services/os-service';
import { initContextMenu } from './context-menu';
import { updateZoomLevels } from './main-window';

export const views = new Map<string, BrowserView>();
const viewQueue: string[] = [];

async function openDialog(event: IpcMainInvokeEvent, options: Electron.OpenDialogOptions) {
    return await dialog.showOpenDialog(options);
}

function setTitle(window: BrowserWindow, event: IpcMainInvokeEvent, title: string) {
    window.setTitle(title)
    return title;
}

async function clearData(window: BrowserWindow) {
    const session = window.webContents.session;
    //possibly clear everything not sure what's the issue
    await session.clearCache()
    await session.clearStorageData({
        storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'cachestorage']
    })
}

export async function toggleDevTools(mainWindow: BrowserWindow, bgWindow?: BrowserWindow) {
    mainWindow.webContents.toggleDevTools()

    if (bgWindow) {
        if (bgWindow.isVisible()) {
            bgWindow.hide()
        } else {
            bgWindow.show()
        }

        bgWindow.webContents.toggleDevTools()
    }
}

async function createView(mainWindow: BrowserWindow, createNewWindow, data: ViewData) {
    const { url, bounds } = data;
    let view = views.get(url);
    const newView = !view;

    if (newView) {
        view = new BrowserView();
        initContextMenu(createNewWindow, undefined, mainWindow.webContents.getURL(), view)
        await view.webContents.loadURL(url);
        views.set(url, view);
        viewQueue.push(url);
    }

    const browserViews = mainWindow.getBrowserViews();
    if (browserViews.length > 0) {
        browserViews.forEach(browserView => {
            mainWindow.removeBrowserView(browserView)
        })
    }

    mainWindow.addBrowserView(view);

    //this is all hacks just to get zoomfactor to update correctly 🙄
    mainWindow.webContents.zoomFactor = mainWindow.webContents.zoomFactor + 0;
    view.webContents.zoomFactor = mainWindow.webContents.zoomFactor;
    const mainBounds = mainWindow.getBounds();
    mainWindow.setBounds({
        ...mainBounds,
        width: mainBounds.width + 1,
        height: mainBounds.height + 1
    });
    mainWindow.setBounds(mainBounds);

    setTimeout(() => {
        setViewBounds(view, mainWindow, data);
        updateZoomLevels(mainWindow);
    }, 10);
}

function setViewBounds(view: BrowserView, mainWindow: BrowserWindow, { bounds }: ViewData) {
    const { x, y, width, height } = bounds;
    const mainZoom = mainWindow.webContents.zoomFactor;
    const zoom = mainZoom;
    
    isDev && console.log({ zoom, bounds })
    view.setBounds({
        x: Math.round(x * zoom),
        y: Math.round(y * zoom),
        width: Math.round(width * zoom),
        height: Math.round(height * zoom)
    })
}

async function updateViewBounds(data: ViewData, mainWindow: BrowserWindow) {
    const view = views.get(data.url)
    if (view) {
        setViewBounds(view, mainWindow, data);
        updateZoomLevels(mainWindow)
    }
}

async function removeView(mainWindow: BrowserWindow, url: string) {
    const view = views.get(url)

    if (view) {
        isDev && console.log('removing', url)
        mainWindow.removeBrowserView(view)

        if (viewQueue.length >= 5) {
            const oldUrl = viewQueue.shift()
            const oldView = views.get(oldUrl);
            (oldView.webContents as any).destroy();
            views.delete(oldUrl)
        }
    }
}

function installUpdates(bgWindow: BrowserWindow) {
    if (!isDev) {
        bgWindow.close();
        autoUpdater.quitAndInstall();
    } else {
        console.log('quitting')
        bgWindow.close();
        app.quit();
    }
}

export function start(mainWindow: BrowserWindow, createNewWindow, bgWindow?: BrowserWindow): void {
    ipcMain.handle('open-dialog', openDialog)
    ipcMain.handle('set-title', (event, args) => setTitle(mainWindow, event, args))
    ipcMain.handle('clear-data', () => clearData(mainWindow))
    ipcMain.handle('toggle-dev-tools', () => toggleDevTools(mainWindow, bgWindow))
    ipcMain.handle('create-view', (event, args) => createView(mainWindow, createNewWindow, args))
    ipcMain.handle('update-view-bounds', (event, args) => updateViewBounds(args, mainWindow))
    ipcMain.handle('remove-view', (event, args) => removeView(mainWindow, args))
    ipcMain.handle('install-updates', () => installUpdates(bgWindow))
}