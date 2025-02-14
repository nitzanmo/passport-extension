import { Worker, WorkerConfig } from '@src/content-script/worker';
import { StorageService } from '@src/services/storage';
import { HttpService } from '@src/lib/http';
import { VisitService } from '@src/lib/visit';
import differenceInDays from 'date-fns/differenceInDays';
import { ResponseStatus } from '@src/lib/internal-types';
import { Locations } from '@src/lib/locations';

export class Gamkenbot {
  constructor(private readonly worker = new Worker(), private readonly storageService = new StorageService()) {}

  onRejectError = async () => {
    await this.worker.stop();
    await this.storageService.setLoggedIn(false);
  };

  setLoggedIn = async (): Promise<boolean> => {
    const httpService = new HttpService(this.onRejectError);
    try {
      const userInfo = await httpService.getUserInfo();
      await this.storageService.setLoggedIn(userInfo?.Results !== null);
      return true;
    } catch (e: unknown) {
      console.error(e);
      return false;
    }
  };

  startSearching = async (): Promise<boolean> => {
    const httpService = new HttpService(this.onRejectError);
    const info = await this.storageService.getUserMetadata();
    const visitService = new VisitService(httpService);

    if (!info) {
      return false;
    }

    const daysDiff = differenceInDays(new Date(info.lastDate), new Date());
    const preparedVisit = await visitService.prepare(info);

    if (preparedVisit.status === ResponseStatus.Success) {
      httpService.updateVisitToken(preparedVisit.data.visitToken);
      const locations = Locations.filter((location) => info.cities.includes(location.city));
      const config: WorkerConfig = {
        locations,
        userVisit: preparedVisit.data,
        maxDaysUntilAppointment: daysDiff,
        httpService: httpService,
      };
      await this.worker.start(config);

      return true;
    } else {
      return false;
    }
  };

  stopSearching = async (): Promise<boolean> => {
    try {
      await this.worker.stop();
      return true;
    } catch (e: unknown) {
      console.error(e);
      return false;
    }
  };
}
