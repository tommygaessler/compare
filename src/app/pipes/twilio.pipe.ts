import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'twilio',
  pure: false
})
export class TwilioPipe implements PipeTransform {

  transform(participants: any, ...args: unknown[]): any {
    return Array.from(participants, ([name, value]) => ({name, value}));
  }

}
