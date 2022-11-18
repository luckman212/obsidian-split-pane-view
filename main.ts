// inspired by: https://forum.obsidian.md/t/viewing-note-in-side-by-side-mode-how-to-create-a-new-note-and-have-it-replace-the-current-view-instead-of-opening-a-new-tab

import {
	App,
	WorkspaceLeaf,
	TFile,
	Notice,
	SplitDirection,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';

declare module "obsidian" {
	interface View {
		file: TFile;
		getMode: Function;
	}
	interface WorkspaceLeaf {
		id: string;
		group: string;
	}
}

interface SplitViewPluginSettings {
	DIRECTION: SplitDirection;
	CLOSE_OTHER: boolean;
}

const DEFAULT_SETTINGS: SplitViewPluginSettings = {
	DIRECTION: 'vertical',
	CLOSE_OTHER: true
}

export const getMarkdownLeaves = (): Array<WorkspaceLeaf> | null => app.workspace.getLeavesOfType('markdown') ?? null

export default class SplitViewPlugin extends Plugin {
	settings: SplitViewPluginSettings;

	async onload() {
		console.log('loading %s plugin', this.manifest.name);
		await this.loadSettings();

		this.app.workspace.onLayoutReady(() => {

			this.addSettingTab(new SplitViewPluginSettingsTab(this.app, this));

			const ribbonIconEl = this.addRibbonIcon('vertical-split', 'Open Split View', (evt: MouseEvent) => {
				this.openSplitPaneView();
			});
			ribbonIconEl.addClass('split-view-plugin-ribbon-class');

			this.addCommand({
				id: 'open-split-view',
				name: 'Open Split View',
				checkCallback: (checking: boolean) => {
					if (getMarkdownLeaves()) {
						if (!checking) {
							this.openSplitPaneView();
						}
						return true;
					}
				}
			});

			this.addCommand({
				id: 'close-other-leaves',
				name: 'Close Other Leaves',
				checkCallback: (checking: boolean) => {
					if (getMarkdownLeaves()) {
						if (!checking) {
							let mrl = this.getMostRecentMDLeaf();
							if (!!mrl) {
								this.closeOtherLeaves(mrl.id);
							} else {
								new Notice('Could not determine which pane(s) to close.');
							}
						}
						return true;
					}
				}
			});
		});
	}

	onunload() {
		console.log('unloading %s plugin', this.manifest.name);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getMostRecentMDLeaf(): WorkspaceLeaf | null {
		const mrl: WorkspaceLeaf | null = this.app.workspace.getMostRecentLeaf();
		if (!!mrl && mrl.view.getViewType() === 'markdown') {
			return mrl;
		} else {
			return null;
		}
	}


	async closeOtherLeaves(id: string): Promise<void> {
		if (!id) return;
		this.app.workspace.detachLeavesOfType('empty');
		this.app.workspace.getLeavesOfType('markdown').forEach((leaf: WorkspaceLeaf) => { //leaf: WorkspaceLeaf & { id: string }
			if (leaf.id !== id) {
				//console.log('closing non-primary leaf: %s', leaf.view.file.basename);
				leaf.detach();
			}
		});
	}

	async openSplitPaneView() {
		const srcLeaf: WorkspaceLeaf | null = this.getMostRecentMDLeaf();
		if (!srcLeaf) {
			new Notice('Could not determine active file!');
			return;
		}
		if (this.settings.CLOSE_OTHER) { //close empty & non-primary leaves
			this.closeOtherLeaves(srcLeaf.id);
		}
		const srcFile: TFile = srcLeaf?.view.file;
		//const newLeaf = this.app.workspace.createLeafBySplit(srcLeaf, this.settings.DIRECTION, false);
		const newLeaf = this.app.workspace.getLeaf('split', this.settings.DIRECTION);
		await newLeaf.openFile(srcFile, { state: { mode: 'preview', active: true, focus: false } });
		if (srcLeaf.view.getMode() === 'preview') {
			await srcLeaf.view.setState({
				...srcLeaf.view.getState(),
				mode: 'source'
			}, {});
		}
		srcLeaf.setGroupMember(newLeaf);
		this.app.workspace.setActiveLeaf(srcLeaf, true, true);
	}
}

class SplitViewPluginSettingsTab extends PluginSettingTab {
	plugin: SplitViewPlugin;

	constructor(app: App, plugin: SplitViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Split Pane View Helper Settings" });

		new Setting(containerEl)
			.setName("Split Direction")
			.setDesc(
				"Vertical = left/right, Horizontal = up/down."
			)
			.addDropdown(dropdown => {
				dropdown
					.addOptions({
						vertical: "Vertical",
						horizontal: "Horizontal"
					})
					.setValue(this.plugin.settings.DIRECTION)
					.onChange(async value => {
						this.plugin.settings.DIRECTION =
							value as SplitDirection;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Close Other Panes")
			.setDesc(
				"When activating the plugin, close all other non-related panes."
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.CLOSE_OTHER)
					.onChange(async value => {
						this.plugin.settings.CLOSE_OTHER = value;
						await this.plugin.saveSettings();
					});
			});

		}
}
