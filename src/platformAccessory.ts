import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { ChuangoH4HomebridgePlatform } from './platform';

import { DeviceConnection, AlarmState, ArmState, Device, Alarm, ItemEventType } from 'chuango-h4-client';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ChuangoH4PlatformAccessory {
    private service: Service;
    private targetState: any;
    private detectors: any = {};

    constructor(
        private readonly platform: ChuangoH4HomebridgePlatform,
        private readonly accessory: PlatformAccessory,
        private readonly connection: DeviceConnection
    ) {

        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Chuango')
      .setCharacteristic(this.platform.Characteristic.Model, 'H4');

        this.service = this.accessory.getService(this.platform.Service.SecuritySystem) || this.accessory.addService(this.platform.Service.SecuritySystem);

        this.service.setCharacteristic(this.platform.Characteristic.Name, "H4");

        // create handlers for required characteristics
        this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
            .on('get', this.handleSecuritySystemCurrentStateGet.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
            .on('get', this.handleSecuritySystemTargetStateGet.bind(this))
            .on('set', this.handleSecuritySystemTargetStateSet.bind(this));

        this.connection.on("alarm", (alarm: Alarm) => {
            this.platform.log.info("Got alarm: " + JSON.stringify(alarm));

            if(alarm.itemEvent == ItemEventType.Alarm || alarm.itemEvent == ItemEventType.AbnormalEvent || alarm.itemEvent == ItemEventType.SOSAlarm) {
                this.service.setCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);

                const detector = this.detectors[alarm.deviceID];
                if(detector) {
                    const node = detector.device.NodesList[0];
                    switch(node.FuncType) {
                        case "SS":
                            detector.service.setCharacteristic(this.platform.Characteristic.MotionDetected, true);
                            break;
                        case "OD":
                            detector.service.setCharacteristic(this.platform.Characteristic.ContactSensorState, true);
                            break;
                    }
                }
            }
        });

        this.connection.on("state", (state: AlarmState) => {
            this.platform.log.info("Alarm state changed: " + JSON.stringify(state));

            const newState = this.alarmStateToHomebridge(state);
            this.service.setCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, newState);
            if(!state.Alarm) {
                this.targetState = newState;
                this.service.setCharacteristic(this.platform.Characteristic.SecuritySystemTargetState, newState);
            }
        });


        this.connection.getAllDevices().then((devices: Device[]) => {
            for(const device of devices) {
                let acc = this.accessory.getService(device.DevName.trim());
                if(!acc) {
                    // homebridge does not know about this service, so we need to build it
                    const node = device.NodesList[0];
                    switch(node.FuncType) {
                        case "SS":
                            acc = this.accessory.addService(this.platform.Service.MotionSensor, device.DevName.trim(), node.UUID);
                            break;
                        case "OD":
                            acc = this.accessory.addService(this.platform.Service.ContactSensor, device.DevName.trim(), node.UUID);
                            break;
                    }

                }

                if(acc) {
                    // save off the device service for later
                    this.detectors[device.DevId] = { device: device, service: acc };
                }
            }
            // this.platform.log.info("Connected devices:\n", JSON.stringify(devices, null, 2));
        });
    }


    handleSecuritySystemCurrentStateGet(callback) {
        this.platform.log.debug('Triggered GET SecuritySystemCurrentState');

        this.connection.getCurrentAlarmState().then((state: AlarmState) => {
            const currentValue = this.alarmStateToHomebridge(state);

            callback(null, currentValue);
        });
    }


    /**
     * Handle requests to get the current value of the "Security System Target State" characteristic
     */
    handleSecuritySystemTargetStateGet(callback) {
        this.platform.log.debug('Triggered GET SecuritySystemTargetState');

        callback(null, this.targetState);
    }

    /**
     * Handle requests to set the "Security System Target State" characteristic
     */
    handleSecuritySystemTargetStateSet(value, callback) {
        this.platform.log.debug('Triggered SET SecuritySystemTargetState:', value);
        if(this.targetState != value) {
            this.targetState = value;

            const newState = this.homebridgeStateToArmState(value);

            if(newState) {
                this.connection.setAlarmState(newState);
            }
        }

        callback(null);
    }

    homebridgeStateToArmState(value: any): ArmState | null {
        switch(value) {
            case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
                return ArmState.Home;
            case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
                return ArmState.Armed;
            case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                return ArmState.Home;
            case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
                return ArmState.Disarmed;
        }

        return null;
    }

    alarmStateToHomebridge(state: AlarmState): any {
        if(state.Alarm) {
            return this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        } else {
            switch(state.State) {
                case ArmState.Home:
                    return this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;
                case ArmState.Disarmed:
                    return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
                case ArmState.Armed:
                    return this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                case ArmState.SOS:
                    return this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
            }
        }

        // this should never happen
        throw "Invalid alarm state encountered: " + JSON.stringify(state);
    }


}
