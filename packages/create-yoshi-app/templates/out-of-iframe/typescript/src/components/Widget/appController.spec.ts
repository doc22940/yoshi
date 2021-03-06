import LaboratoryTestkit from '@wix/wix-experiments/dist/src/laboratory-testkit';
import { ExperimentsBag } from '@wix/wix-experiments';
import { EXPERIMENTS_SCOPE } from '../../config/constants';

import { createAppController } from './appController';

export function mockExperiments(
  scope: string,
  experiments: ExperimentsBag,
): void {
  new LaboratoryTestkit()
    .withScope(scope)
    .withBaseUrl(window.location.href)
    .withExperiments(experiments)
    .start();
}

describe('createAppController', () => {
  it('should call setProps with data', async () => {
    mockExperiments(EXPERIMENTS_SCOPE, { someExperiment: 'true' });
    const setPropsSpy = jest.fn();
    const appParams: any = {
      baseUrls: {
        staticsBaseUrl: 'http://some-static-url.com',
      },
    };
    const language = 'en-US';
    const experiments = { someExperiment: 'true' };

    const controller = await createAppController({
      appParams,
      setProps: setPropsSpy,
      wixCodeApi: {
        window: {
          multilingual: {
            isEnabled: false,
          },
        },
        site: {
          language,
        },
      },
    } as any);

    controller.pageReady();

    expect(setPropsSpy).toBeCalledWith({
      name: 'World',
      cssBaseUrl: appParams.baseUrls.staticsBaseUrl,
      language,
      experiments,
    });
  });
});
