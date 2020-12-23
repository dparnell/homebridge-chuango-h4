import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { ChuangoH4HomebridgePlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, ChuangoH4HomebridgePlatform);
};
