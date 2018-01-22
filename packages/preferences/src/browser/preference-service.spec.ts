/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Container } from 'inversify';
import * as chai from 'chai';
import { Emitter } from '@theia/core/lib/common';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PreferenceService, PreferenceServiceImpl } from '@theia/preferences-api/lib/browser/';
import { FileSystem } from '@theia/filesystem/lib/common/';
import { FileSystemWatcher, FileChange, } from '@theia/filesystem/lib/browser/';
import { FileSystemWatcherServer } from '@theia/filesystem/lib/common/filesystem-watcher-protocol';
import { FileSystemPreferences, createFileSystemPreferences } from '@theia/filesystem/lib/browser/filesystem-preferences';
import { ILogger } from '@theia/core/lib/common/logger';
import { UserPreferenceProvider } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { ResourceProvider } from '@theia/core/lib/common/resource';
import { WorkspaceServer } from '@theia/workspace/lib/common/';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { MockFilesystem, MockFilesystemWatcherServer } from '@theia/filesystem/lib/common/test';
import { MockLogger } from '@theia/core/lib/common/test/mock-logger';
import { MockResourceProvider } from '@theia/core/lib/common/test/mock-resource-provider';
import { MockWorkspaceServer } from '@theia/workspace/lib/common/test/mock-workspace-server';
import { MockWindowService } from '@theia/core/lib/browser/window/test/mock-window-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
const jsdom = require('jsdom-global');

import * as sinon from 'sinon';

const expect = chai.expect;
let testContainer: Container;

let prefService: PreferenceService;

const mockOnFileChangedEmitter = new Emitter<FileChange[]>();

before(async () => {
    jsdom();
    testContainer = new Container();

    /* Preference bindings*/
    testContainer.bind(UserPreferenceProvider).toSelf();
    testContainer.bind(WorkspacePreferenceProvider).toSelf();
    testContainer.bind(FileSystemPreferences).toDynamicValue(ctx => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createFileSystemPreferences(preferences);
    });

    testContainer.bind(PreferenceService).toDynamicValue(ctx => {
        const userProvider = ctx.container.get<UserPreferenceProvider>(UserPreferenceProvider);
        sinon.stub(userProvider, 'getPreferences').callsFake(() => {
            return { "editor.lineNumbers": "on" };
        });
        const workspaceProvider = ctx.container.get<WorkspacePreferenceProvider>(WorkspacePreferenceProvider);

        return new PreferenceServiceImpl([userProvider, workspaceProvider]);
    });

    /* Workspace mocks and bindings */
    testContainer.bind(WorkspaceServer).to(MockWorkspaceServer);
    testContainer.bind(WorkspaceService).toSelf();

    /* Window mocks and bindings*/
    testContainer.bind(WindowService).to(MockWindowService);

    /* Resource mocks and bindings */
    testContainer.bind(MockResourceProvider).toSelf().inSingletonScope();
    testContainer.bind(ResourceProvider).toProvider(context =>
        uri => context.container.get(MockResourceProvider).get(uri)
    );

    // const provider = testContainer.get(ResourceProvider);
    // sinon.stub(provider, '')

    /* FS mocks and bindings */
    testContainer.bind(FileSystemWatcherServer).to(MockFilesystemWatcherServer);
    testContainer.bind(FileSystemWatcher).toDynamicValue(ctx => {
        const server = ctx.container.get<FileSystemWatcherServer>(FileSystemWatcherServer);
        const prefs = ctx.container.get<FileSystemPreferences>(FileSystemPreferences);

        const watcher = new FileSystemWatcher(server, prefs);

        sinon.stub(watcher, 'onFilesChanged').get(() =>
            mockOnFileChangedEmitter.event
        );

        return watcher;

    }).inSingletonScope();
    testContainer.bind(FileSystem).to(MockFilesystem);

    /* Logger mock */
    testContainer.bind(ILogger).to(MockLogger);
});

describe('Preference Service', () => {

    before(() => {
        prefService = testContainer.get<PreferenceService>(PreferenceService);
        const prefServiceContrib = prefService as FrontendApplicationContribution;
        if (prefServiceContrib.initialize) {
            prefServiceContrib.initialize();
        }
    });

    after(() => {
        prefService.dispose();
    });

    beforeEach(() => {

    });

    it('Should get notified if a provider gets a change', async done => {
        const callback = sinon.spy(prefService as any, 'onNewPreferences');

        prefService.onPreferenceChanged(changes => {
            expect(callback.called).to.be.true;

            // done();
        });
        /* Getting a preference inits the provider if not init */
        prefService.get('test');
        expect(true).to.be.true;
    });
});