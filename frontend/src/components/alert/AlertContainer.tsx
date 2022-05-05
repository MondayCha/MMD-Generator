import { toast, resolveValue, Toaster } from 'react-hot-toast';
import { X } from 'tabler-icons-react';

const AlertContainer = () => {
  return (
    <Toaster position="bottom-center">
      {(t) => (
        // https://github.com/timolins/react-hot-toast/issues/153
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } flex items-center rounded-xl ${
            t.type === 'error' ? 'bg-orange-700' : 'bg-sky-700'
          } p-2.5 leading-none text-indigo-100 lg:inline-flex`}
          role="alert"
        >
          <span className="mr-1 ml-1 flex-auto text-left font-semibold">
            {resolveValue(t.message, t)}
          </span>
          <span
            className="ml-1 flex cursor-pointer rounded-full bg-white bg-opacity-25 p-1 text-xs font-bold hover:bg-opacity-50"
            onClick={() => toast.dismiss(t.id)}
          >
            <X size={12} strokeWidth={3} />
          </span>
        </div>
      )}
    </Toaster>
  );
};

export default AlertContainer;
