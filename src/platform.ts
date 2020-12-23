import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ChuangoH4PlatformAccessory } from './platformAccessory';

import { Client, DeviceInfo, DeviceConnection } from 'chuango-h4-client';

export class ChuangoH4HomebridgePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform Chuango H4');

        this.api.on('didFinishLaunching', () => {
            this.log.info("Logging in...");

            Client.login(this.config.username as string, this.config.password as string, this.config.guid as string).then((client: Client) => {
                this.log.info('Login successful');
                this.discoverDevices(client);
            }).catch((e) => {
                this.log.error(e);
            });
        });
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    exploreDevice(client: Client, device: DeviceInfo) {
        client.connect(device).then((connection: DeviceConnection) => {
            this.log.info("Connected to device " + device.deviceID);

            const uuid = this.api.hap.uuid.generate(device.deviceID);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            if(existingAccessory) {
                new ChuangoH4PlatformAccessory(this, existingAccessory, connection);
            } else {
                const accessory = new this.api.platformAccessory(device.deviceID, uuid);
                new ChuangoH4PlatformAccessory(this, accessory, connection);
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        });

    }

    discoverDevices(client: Client) {
        this.log.info("Discovering chuango devices...");
        client.listDevices().then((devices: DeviceInfo[]) => {
            for(const device of devices) {
                this.log.info("Found device " + device.deviceID + " connecting...");
                this.exploreDevice(client, device);
            }
        });
    }
}
