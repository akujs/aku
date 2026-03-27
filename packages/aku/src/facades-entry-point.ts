// GENERATED CODE DO NOT EDIT!
// Run `bun codegen` to regenerate this file
import { createFacade } from "./core/facade.ts";
import { Container as ContainerContract } from "./container/contracts/Container.ts";
import { Configuration as ConfigurationContract } from "./core/contracts/Configuration.ts";
import { Dispatcher as DispatcherContract } from "./core/contracts/Dispatcher.ts";
import { Database as DatabaseContract } from "./database/contracts/Database.ts";
import { KeepAlive as KeepAliveContract } from "./http/contracts/KeepAlive.ts";
import { RequestLocals as RequestLocalsContract } from "./http/contracts/RequestLocals.ts";
import { Storage as StorageContract } from "./storage/contracts/Storage.ts";

/**
 * Facade for Container
 */
export const Container: ContainerContract = createFacade(ContainerContract);

/**
 * Facade for Configuration
 */
export const Configuration: ConfigurationContract = createFacade(ConfigurationContract);

/**
 * Facade for Dispatcher
 */
export const Dispatcher: DispatcherContract = createFacade(DispatcherContract);

/**
 * Facade for Database
 */
export const Database: DatabaseContract = createFacade(DatabaseContract);

/**
 * Facade for KeepAlive
 */
export const KeepAlive: KeepAliveContract = createFacade(KeepAliveContract);

/**
 * Facade for RequestLocals
 */
export const RequestLocals: RequestLocalsContract = createFacade(RequestLocalsContract);

/**
 * Facade for Storage
 */
export const Storage: StorageContract = createFacade(StorageContract);
